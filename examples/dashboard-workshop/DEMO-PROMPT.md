# Demo Prompt

Copy and paste the prompt below into Claude Code during the live demo.

> **Note:** Replace the placeholder values with your actual credentials from the `.env` file before pasting. Or, if Claude Code reads the `.env` file automatically, you can leave them as-is and just reference the env vars.

---

## The Prompt

```
Build me a React + Vite + TypeScript single-page app that demonstrates Swig smart wallets using the Swig Developer Portal and Paymaster APIs. Use the swig-smart-wallet skill for reference.

Here's the configuration (also in .env):

- Solana RPC: http://localhost:8899
- Swig Portal URL: https://dashboard.onswig.com
- Swig API Key: <SWIG_API_KEY from .env>
- Swig Policy ID: <SWIG_POLICY_ID from .env>
- Paymaster Public Key: <SWIG_PAYMASTER_PUBKEY from .env>
- Paymaster API URL: http://localhost:3000
- Paymaster Network: devnet

The app should have these 4 steps in a wizard-style UI:

**Step 1 - Generate Keypair:**
Generate an ephemeral Ed25519 keypair in the browser when the page loads. Display the public key. This is the user's wallet key. Use @solana/kit (web3.js 2.x) for this.

**Step 2 - Create Swig Wallet:**
Call the Swig Developer Portal API to create a Swig wallet from the policy template. Use the @swig-wallet/developer package's SwigClient:
- Call `createWallet()` with the policy ID, the generated keypair's public key as walletAddress, walletType "ED25519", network "devnet", and the paymaster pubkey.
- The portal + paymaster handle on-chain creation — no SOL needed from the user.
- Display the returned swigAddress and signature.
- After creation, use @swig-wallet/kit to call fetchSwig() and getSwigWalletAddress() on the local RPC to get the wallet PDA address.

**Step 3 - Airdrop SOL:**
Airdrop 2 SOL to the Swig wallet PDA address using the local RPC's requestAirdrop. Display the balance after airdrop.

**Step 4 - Transfer SOL (Paymaster-Sponsored):**
Build a SOL transfer of 0.5 SOL from the Swig wallet to a hardcoded recipient address. This should:
1. Use @swig-wallet/kit to fetchSwig, find the role for our keypair, and call getSignInstructions to wrap a SOL transfer instruction.
2. Use the @swig-wallet/paymaster-kit PaymasterClient to set the paymaster as fee payer, so the user pays zero gas.
3. The user's ephemeral keypair signs, the paymaster signs and submits.
4. Display the transaction signature and updated balance.

Technical requirements:
- Use bun as the package manager
- Use Vite + React + TypeScript
- Use @solana/kit (web3.js 2.x), @swig-wallet/kit, @swig-wallet/developer, @swig-wallet/paymaster-kit
- Use Tailwind CSS v4 for styling (dark theme)
- All Swig/Solana operations should happen client-side in the browser
- Read config from environment variables via import.meta.env (VITE_ prefix)
- No backend needed — everything talks to local RPC + hosted Swig APIs directly from the browser

After writing the code, run `bun install` and `bun dev` to start it.
```

---

## Optional Follow-Up Prompts

After the initial app is running, you can ask Claude Code to enhance it:

### Show wallet details

```
Add a section after step 4 that fetches and displays the Swig wallet's roles and permissions using fetchSwig. Show each role's ID, authority type, and what actions it can perform.
```

### Add a second transfer to show spend limits

```
Add a step 5 that tries to transfer another 2 SOL. Since the policy has a 2 SOL spend limit and we already spent 0.5, show whether the second transfer succeeds or fails due to the spend limit.
```

### Show the production code comparison

```
Add an info panel at the bottom that shows the equivalent production code snippets — how the same app would work with real wallet adapters instead of ephemeral keypairs, and with mainnet instead of devnet.
```
