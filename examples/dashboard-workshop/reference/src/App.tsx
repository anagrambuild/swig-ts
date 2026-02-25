import {
  getTransferSolInstructionDataEncoder,
  SYSTEM_PROGRAM_ADDRESS,
} from '@solana-program/system';
import {
  AccountRole,
  address,
  createSolanaRpc,
  generateKeyPairSigner,
  getSignatureFromTransaction,
  getTransactionCodec,
  lamports,
  type KeyPairSigner,
} from '@solana/kit';
import { SwigClient } from '@swig-wallet/developer';
import {
  fetchSwig,
  getSignInstructions,
  getSwigWalletAddress,
} from '@swig-wallet/kit';
import { createPaymasterClient } from '@swig-wallet/paymaster-kit';
import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Config from env
// ---------------------------------------------------------------------------
const RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || 'http://localhost:8899';
const PORTAL_URL =
  import.meta.env.VITE_SWIG_PORTAL_URL || 'https://dashboard.onswig.com';
const API_KEY = import.meta.env.VITE_SWIG_API_KEY || '';
const POLICY_ID = import.meta.env.VITE_SWIG_POLICY_ID || '';
const PAYMASTER_PUBKEY = import.meta.env.VITE_SWIG_PAYMASTER_PUBKEY || '';
const PAYMASTER_URL =
  import.meta.env.VITE_SWIG_PAYMASTER_URL || 'http://localhost:3000';
const PAYMASTER_NETWORK = (import.meta.env.VITE_SWIG_PAYMASTER_NETWORK ||
  'devnet') as 'devnet' | 'mainnet';

// Hardcoded recipient for the transfer demo
const RECIPIENT = '11111111111111111111111111111112';

const rpc = createSolanaRpc(RPC_URL);

const swigClient = new SwigClient({
  apiKey: API_KEY,
  baseUrl: PORTAL_URL,
  paymasterUrl: PAYMASTER_URL,
});

const paymaster = createPaymasterClient({
  apiKey: API_KEY,
  paymasterPubkey: PAYMASTER_PUBKEY,
  baseUrl: PAYMASTER_URL,
  network: PAYMASTER_NETWORK,
  customRpcUrl: RPC_URL,
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function formatSol(lamportsVal: bigint): string {
  return (Number(lamportsVal) / 1e9).toFixed(4);
}

function shorten(s: string, n = 6): string {
  if (s.length <= n * 2 + 3) return s;
  return `${s.slice(0, n)}...${s.slice(-n)}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Step = 1 | 2 | 3 | 4;

interface WalletState {
  swigAddress: string;
  swigWalletAddress: string;
  swigId: string;
  signature: string;
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
export default function App() {
  const [step, setStep] = useState<Step>(1);
  const [keypair, setKeypair] = useState<KeyPairSigner | null>(null);
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [balance, setBalance] = useState<bigint>(0n);
  const [transferSig, setTransferSig] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const log = useCallback((msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Step 1: Generate keypair on mount
  useEffect(() => {
    (async () => {
      const kp = await generateKeyPairSigner();
      setKeypair(kp);
      log(`Keypair generated: ${kp.address}`);
    })();
  }, [log]);

  // Step 2: Create Swig wallet from policy template
  const createWallet = async () => {
    if (!keypair) return;
    setLoading(true);
    setError(null);
    try {
      log(`Creating wallet from policy ${POLICY_ID}...`);
      log(`Owner address: ${keypair.address}`);
      log(`Paymaster pubkey: ${shorten(PAYMASTER_PUBKEY)}`);

      const result = await swigClient.createWallet({
        policyId: POLICY_ID,
        walletAddress: keypair.address,
        walletType: 'ED25519',
        network: PAYMASTER_NETWORK,
        paymasterPubkey: PAYMASTER_PUBKEY,
      });

      log(`Swig created! Address: ${result.swigAddress}`);
      log(`TX: ${result.signature}`);

      // Fetch on-chain to get the wallet PDA
      await delay(2000);
      const swig = await fetchSwig(rpc, address(result.swigAddress));
      const walletAddr = await getSwigWalletAddress(swig);
      log(`Wallet PDA: ${walletAddr}`);

      setWallet({
        swigAddress: result.swigAddress,
        swigWalletAddress: walletAddr.toString(),
        swigId: result.swigId,
        signature: result.signature,
      });
      setStep(3);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      log(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Airdrop SOL
  const airdropSol = async () => {
    if (!wallet) return;
    setLoading(true);
    setError(null);
    try {
      log(`Airdropping 2 SOL to ${shorten(wallet.swigWalletAddress)}...`);

      const sig = await (rpc as any)
        .requestAirdrop(wallet.swigWalletAddress, lamports(2_000_000_000n))
        .send();
      log(`Airdrop TX: ${sig}`);

      await delay(2000);

      const bal = await rpc
        .getBalance(address(wallet.swigWalletAddress))
        .send();
      setBalance(bal.value);
      log(`Balance: ${formatSol(bal.value)} SOL`);
      setStep(4);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      log(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // Step 4: Paymaster-sponsored transfer
  const transferSol = async () => {
    if (!wallet || !keypair) return;
    setLoading(true);
    setError(null);
    try {
      log('Building paymaster-sponsored SOL transfer...');

      // Fetch the swig to get role info
      const swig = await fetchSwig(rpc, address(wallet.swigAddress));
      const roles = swig.findRolesByEd25519SignerPk(keypair.address);
      if (!roles.length) throw new Error('No matching role found');
      const role = roles[0];
      log(`Found role #${role.id} for signer`);

      const currentSlot = BigInt(
        await rpc.getSlot({ commitment: 'finalized' }).send(),
      );

      // Build the inner SOL transfer from the Swig wallet.
      // We construct this manually because the Swig wallet PDA isn't a
      // real signer — the Swig program handles signing via getSignInstructions.
      const transferIx = {
        programAddress: SYSTEM_PROGRAM_ADDRESS,
        accounts: [
          {
            address: address(wallet.swigWalletAddress),
            role: AccountRole.WRITABLE_SIGNER as const,
          },
          {
            address: address(RECIPIENT),
            role: AccountRole.WRITABLE as const,
          },
        ],
        data: new Uint8Array(
          getTransferSolInstructionDataEncoder().encode({
            amount: 500_000_000n,
          }),
        ),
      };

      // Wrap with Swig signing
      const signIxs = await getSignInstructions(
        swig,
        role.id,
        [transferIx],
        false,
        { payer: address(PAYMASTER_PUBKEY), currentSlot },
      );

      log('Creating paymaster transaction (fee payer = paymaster)...');

      // Create tx with paymaster as fee payer, user signs
      const unsignedTx = await paymaster.createTransaction(signIxs, [keypair]);

      log('Paymaster fully signing and submitting...');

      // Paymaster signs and validates
      const fullySignedTx = await paymaster.fullySign(unsignedTx);

      // Get the signature
      const sig = getSignatureFromTransaction(fullySignedTx);
      log(`Transfer TX: ${sig}`);

      // Submit to network
      const txCodec = getTransactionCodec();
      const serialized = txCodec.encode(fullySignedTx);

      await rpc
        .sendTransaction(
          Buffer.from(new Uint8Array(serialized)).toString('base64') as any,
          { encoding: 'base64', skipPreflight: true },
        )
        .send();

      await delay(2000);

      // Refresh balance
      const bal = await rpc
        .getBalance(address(wallet.swigWalletAddress))
        .send();
      setBalance(bal.value);
      setTransferSig(sig.toString());
      log(`Transfer complete! New balance: ${formatSol(bal.value)} SOL`);
    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      log(`Error: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const stepLabels = ['Keypair', 'Create Wallet', 'Airdrop', 'Transfer'];

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">
          <span className="text-[var(--primary)]">Swig</span> Dashboard Workshop
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Policy Templates + Paymaster + Zero Gas
        </p>
      </div>

      {/* Progress */}
      <div className="flex gap-2 mb-8">
        {stepLabels.map((label, i) => (
          <div
            key={label}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              i + 1 === step
                ? 'bg-[var(--primary)] text-white'
                : i + 1 < step
                  ? 'bg-[var(--primary)]/20 text-[var(--primary)]'
                  : 'bg-[var(--card)] text-[var(--muted)]'
            }`}
          >
            <span className="font-mono">{i + 1}</span> {label}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="space-y-6">
        {/* Step 1: Keypair */}
        <Section title="Step 1: Ephemeral Keypair" active={step >= 1}>
          {keypair ? (
            <div className="space-y-2">
              <Label>Public Key</Label>
              <Mono>{keypair.address}</Mono>
              <p className="text-xs text-[var(--muted)]">
                Generated in the browser. In production, this comes from the
                user's wallet adapter (Phantom, Backpack, etc.).
              </p>
              {step === 1 && (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="btn mt-3"
                >
                  Next: Create Wallet
                </button>
              )}
            </div>
          ) : (
            <p className="text-[var(--muted)]">Generating keypair...</p>
          )}
        </Section>

        {/* Step 2: Create Wallet */}
        {step >= 2 && (
          <Section
            title="Step 2: Create Swig Wallet from Policy"
            active={step === 2}
          >
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label>Policy ID</Label>
                  <Mono>{shorten(POLICY_ID, 10)}</Mono>
                </div>
                <div>
                  <Label>Paymaster</Label>
                  <Mono>{shorten(PAYMASTER_PUBKEY)}</Mono>
                </div>
              </div>
              <p className="text-xs text-[var(--muted)]">
                The Swig Developer Portal creates the wallet on-chain using the
                paymaster. Zero SOL needed from the user.
              </p>
              {!wallet && (
                <button
                  type="button"
                  onClick={createWallet}
                  disabled={loading}
                  className="btn mt-3"
                >
                  {loading ? 'Creating...' : 'Create Wallet'}
                </button>
              )}
              {wallet && (
                <div className="space-y-2 mt-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <Label>Swig Account</Label>
                      <Mono>{shorten(wallet.swigAddress, 10)}</Mono>
                    </div>
                    <div>
                      <Label>Wallet PDA</Label>
                      <Mono>{shorten(wallet.swigWalletAddress, 10)}</Mono>
                    </div>
                  </div>
                  <Status type="success">
                    Wallet created! TX: {shorten(wallet.signature, 10)}
                  </Status>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* Step 3: Airdrop */}
        {step >= 3 && (
          <Section title="Step 3: Fund Wallet (Airdrop)" active={step === 3}>
            <div className="space-y-2">
              <p className="text-xs text-[var(--muted)]">
                Airdrop 2 SOL to the Swig wallet PDA. On mainnet, users would
                transfer SOL to this address.
              </p>
              {balance === 0n && (
                <button
                  type="button"
                  onClick={airdropSol}
                  disabled={loading}
                  className="btn mt-3"
                >
                  {loading ? 'Airdropping...' : 'Airdrop 2 SOL'}
                </button>
              )}
              {balance > 0n && (
                <Status type="success">
                  Balance: {formatSol(balance)} SOL
                </Status>
              )}
            </div>
          </Section>
        )}

        {/* Step 4: Transfer */}
        {step >= 4 && (
          <Section
            title="Step 4: SOL Transfer (Paymaster-Sponsored)"
            active={step === 4}
          >
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <Label>Amount</Label>
                  <p className="font-medium">0.5 SOL</p>
                </div>
                <div>
                  <Label>Recipient</Label>
                  <Mono>{shorten(RECIPIENT)}</Mono>
                </div>
                <div>
                  <Label>Fee Payer</Label>
                  <p className="font-medium text-[var(--primary)]">
                    Paymaster (not the user)
                  </p>
                </div>
                <div>
                  <Label>Balance</Label>
                  <p className="font-medium">{formatSol(balance)} SOL</p>
                </div>
              </div>
              {!transferSig && (
                <button
                  type="button"
                  onClick={transferSol}
                  disabled={loading}
                  className="btn mt-3"
                >
                  {loading ? 'Transferring...' : 'Transfer 0.5 SOL'}
                </button>
              )}
              {transferSig && (
                <div className="space-y-2 mt-3">
                  <Status type="success">
                    Transfer complete! Sig: {shorten(transferSig, 10)}
                  </Status>
                  <p className="text-sm">
                    New balance: <strong>{formatSol(balance)} SOL</strong>
                  </p>
                  <p className="text-xs text-[var(--muted)]">
                    The user paid zero gas. The paymaster covered the
                    transaction fee.
                  </p>
                </div>
              )}
            </div>
          </Section>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-lg border border-[var(--error)] bg-[var(--error)]/10 p-3 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      {/* Logs */}
      <div className="mt-8">
        <h3 className="text-sm font-semibold mb-2 text-[var(--muted)]">
          Activity Log
        </h3>
        <div className="rounded-lg bg-[var(--card)] border border-[var(--border)] p-3 max-h-48 overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-[var(--muted)]">Waiting...</p>
          ) : (
            logs.map((l, i) => (
              <div key={i} className="py-0.5">
                {l}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------
function Section({
  title,
  active,
  children,
}: {
  title: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border p-5 transition-colors ${
        active
          ? 'border-[var(--primary)]/40 bg-[var(--card)]'
          : 'border-[var(--border)] bg-[var(--card)]/50'
      }`}
    >
      <h2 className="text-base font-semibold mb-3">{title}</h2>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-[var(--muted)] mb-0.5">{children}</div>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-xs bg-[var(--bg)] rounded px-2 py-1 break-all">
      {children}
    </div>
  );
}

function Status({
  type,
  children,
}: {
  type: 'success' | 'error';
  children: React.ReactNode;
}) {
  const color = type === 'success' ? 'var(--success)' : 'var(--error)';
  return (
    <div
      className="rounded-lg border p-2.5 text-sm"
      style={{
        borderColor: `${color}33`,
        backgroundColor: `${color}11`,
        color,
      }}
    >
      {children}
    </div>
  );
}
