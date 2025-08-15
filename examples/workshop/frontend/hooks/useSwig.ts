// STEP 0: Main Swig Hook - Core integration logic for the workshop
// This hook manages all Swig account operations: creation, funding, and delegation
import {
  generateKeyPairSigner,
  lamports,
  type Address,
  type KeyPairSigner,
} from '@solana/kit';
import {
  Actions,
  createEd25519AuthorityInfo,
  fetchSwig,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  type Swig,
} from '@swig-wallet/kit';
import { useCallback, useState } from 'react';
import { createConnection, LAMPORTS_PER_SOL } from '../lib/solana';
import { sendTransaction } from '../lib/transactions';

export interface SwigAccount {
  id: Uint8Array;
  address: Address;
  userKeypair: KeyPairSigner;
  managerKeypair: KeyPairSigner;
  swig?: Swig;
}

export function useSwig() {
  const [account, setAccount] = useState<SwigAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connection = createConnection();

  // STEP 1: Create a new Swig account with user and manager keypairs
  const createAccount = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Generate two keypairs: user (owner) and manager (for delegation)
      const userKeypair = await generateKeyPairSigner();
      const managerKeypair = await generateKeyPairSigner();

      // Airdrop SOL to both keypairs and wait for finalization
      await connection.rpc
        .requestAirdrop(userKeypair.address, lamports(BigInt(LAMPORTS_PER_SOL)))
        .send();

      await connection.rpc
        .requestAirdrop(
          managerKeypair.address,
          lamports(BigInt(LAMPORTS_PER_SOL)),
        )
        .send();

      // Brief delay to ensure airdrops are finalized on local validator
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const randomBytes = (length: number): Uint8Array => {
        const randomArray = new Uint8Array(length);
        crypto.getRandomValues(randomArray);
        return randomArray;
      };

      const id = randomBytes(32);
      const swigAddress = await findSwigPda(id);

      const rootActions = Actions.set().all().get();

      const createIx = await getCreateSwigInstruction({
        payer: userKeypair.address,
        actions: rootActions,
        authorityInfo: createEd25519AuthorityInfo(userKeypair.address),
        id,
      });

      // Create the Swig account (sendTransaction waits for confirmation)
      await sendTransaction(connection, [createIx], userKeypair);

      await new Promise((resolve) => setTimeout(resolve, 2000));

      const swig = await fetchSwig(connection.rpc, swigAddress);

      const rootRole = swig.findRolesByEd25519SignerPk(userKeypair.address)[0];
      const manageAuthorityActions = Actions.set().manageAuthority().get();

      const addAuthorityIx = await getAddAuthorityInstructions(
        swig,
        rootRole.id,
        createEd25519AuthorityInfo(managerKeypair.address),
        manageAuthorityActions,
      );

      // Add manager authority (sendTransaction waits for confirmation)
      await sendTransaction(connection, addAuthorityIx, userKeypair);

      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Refetch to get updated state
      await swig.refetch();

      const newAccount: SwigAccount = {
        id,
        address: swigAddress,
        userKeypair,
        managerKeypair,
        swig,
      };

      setAccount(newAccount);
      return newAccount;
    } catch (err) {
      console.error('Error creating Swig account:', err);
      setError(err instanceof Error ? err.message : 'Failed to create account');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // STEP 2: Fund the Swig account with SOL
  const fundAccount = useCallback(
    async (amount: number) => {
      if (!account) throw new Error('No account available');

      setLoading(true);
      setError(null);

      try {
        // STEP 2: Airdrop SOL to the Swig account (only works on local validator)
        await connection.rpc
          .requestAirdrop(
            account.address,
            lamports(BigInt(amount * LAMPORTS_PER_SOL)),
          )
          .send();

        // Brief delay to ensure airdrop is finalized on local validator
        await new Promise((resolve) => setTimeout(resolve, 2000));

        if (account.swig) {
          await account.swig.refetch();
        }
      } catch (err) {
        console.error('Error funding account:', err);
        setError(err instanceof Error ? err.message : 'Failed to fund account');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [account],
  );

  // STEP 3: Delegate authority to the backend for automated actions
  const delegateToBackend = useCallback(
    async (backendAddress: Address) => {
      if (!account || !account.swig) throw new Error('No account available');

      setLoading(true);
      setError(null);

      try {
        // Find the manager role that can add new authorities
        const managerRole = account.swig.findRolesByEd25519SignerPk(
          account.managerKeypair.address,
        )[0];

        if (!managerRole) throw new Error('Manager role not found');

        // STEP 3: Define what actions the backend can perform (limited to 0.1 SOL)
        const backendActions = Actions.set()
          .solLimit({ amount: BigInt(0.1 * LAMPORTS_PER_SOL) })
          .get();

        const addBackendAuthorityIx = await getAddAuthorityInstructions(
          account.swig,
          managerRole.id,
          createEd25519AuthorityInfo(backendAddress),
          backendActions,
        );

        // Delegate authority to backend (sendTransaction waits for confirmation)
        await sendTransaction(
          connection,
          addBackendAuthorityIx,
          account.managerKeypair,
        );

        // Refetch to get updated state
        await account.swig.refetch();
      } catch (err) {
        console.error('Error delegating to backend:', err);
        setError(err instanceof Error ? err.message : 'Failed to delegate');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [account],
  );

  const getBalance = useCallback(async () => {
    if (!account) return 0;

    try {
      const balance = await connection.rpc.getBalance(account.address).send();
      return Number(balance.value);
    } catch (err) {
      console.error('Error getting balance:', err);
      return 0;
    }
  }, [account]);

  const refreshSwig = useCallback(async () => {
    if (!account) {
      console.log('no account?');
      return;
    }

    try {
      const updatedSwig = await fetchSwig(connection.rpc, account.address);
      console.log({ account });
      console.log({ updatedSwig });
      await updatedSwig.refetch();
      console.log({ updatedSwig });

      setAccount((prevAccount) =>
        prevAccount
          ? {
              ...prevAccount,
              swig: updatedSwig,
            }
          : null,
      );
    } catch (err) {
      console.error('Error refreshing Swig data:', err);
    }
  }, [account]);

  return {
    account,
    loading,
    error,
    createAccount,
    fundAccount,
    delegateToBackend,
    getBalance,
    refreshSwig,
  };
}
