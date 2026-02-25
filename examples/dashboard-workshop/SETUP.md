# Pre-Demo Setup

Complete these steps **before** the live demo.

## 1. Swig Developer Portal Setup

Go to [dashboard.onswig.com](https://dashboard.onswig.com) and:

### a) Create an API Key

1. Sign in / create an account
2. Go to **Settings > API Keys**
3. Create a new API key
4. Copy the key — you'll need it as `SWIG_API_KEY`

### b) Set Up a Paymaster

1. Go to **Paymaster** section
2. Create or note your paymaster
3. Copy the **Paymaster Public Key** — you'll need it as `SWIG_PAYMASTER_PUBKEY`

### c) Create a Policy Template

1. Go to **Policies**
2. Create a new policy with these settings:
   - **Name**: "Workshop SOL Wallet"
   - **Authority Type**: Ed25519 (leave the public key blank — it gets filled at wallet creation time)
   - **Actions**: Add `SolLimit` with amount `2000000000` (2 SOL)
3. Copy the **Policy ID** — you'll need it as `SWIG_POLICY_ID`

> **Tip:** You can also create a second policy with `All` permissions as a backup.

## 2. Local Services

### a) Solana Test Validator

Start a local Solana validator with the Swig program loaded:

```bash
solana-test-validator --bpf-program swigypWHEksbC64pWKwah1WTeh9JXwx8H1rJHLdbQMB ./swig.so --reset
```

> The `swig.so` file is in the root of this monorepo. The `--reset` flag gives you a clean ledger.

Verify it's running:

```bash
solana cluster-version -u localhost
```

### b) Local Paymaster (if not using hosted)

If you're running the paymaster locally, start it and note the endpoint URL.
The default hosted endpoint is `https://api.onswig.com` but for local dev
you may have a local paymaster running at `http://localhost:3000`.

## 3. Install the Swig Skill

The skill teaches Claude Code how to use the Swig SDK. Install it into the
demo project directory:

```bash
# Create the demo directory
mkdir -p ~/demo-swig-app
cd ~/demo-swig-app

# Install the skill for Claude Code
mkdir -p .claude/skills/swig-smart-wallet
curl -sL "https://raw.githubusercontent.com/anagrambuild/swig-ts/feat/agentic-skills-and-mcp-server/skills/swig-smart-wallet/SKILL.md" \
  -o .claude/skills/swig-smart-wallet/SKILL.md
```

Verify:

```bash
cat .claude/skills/swig-smart-wallet/SKILL.md | head -5
```

## 4. Environment Variables

Create a `.env` file in the demo directory:

```bash
cat > ~/demo-swig-app/.env << 'EOF'
# Solana
SOLANA_RPC_URL=http://localhost:8899

# Swig Developer Portal
SWIG_API_KEY=your-api-key-here
SWIG_POLICY_ID=your-policy-id-here

# Swig Paymaster
SWIG_PAYMASTER_PUBKEY=your-paymaster-pubkey-here
SWIG_PAYMASTER_API_KEY=your-api-key-here
SWIG_PAYMASTER_NETWORK=devnet
SWIG_PAYMASTER_URL=http://localhost:3000

# Portal URL (for wallet creation API)
SWIG_PORTAL_URL=https://dashboard.onswig.com
EOF
```

Fill in the actual values from steps 1a-1c.

## 5. Pre-flight Checks

Run through this checklist right before the demo:

- [ ] Solana test validator is running (`solana cluster-version -u localhost`)
- [ ] Paymaster service is reachable (`curl http://localhost:3000/health` or hosted endpoint)
- [ ] `.env` file has real values for all keys
- [ ] `swig-smart-wallet` skill is installed in `.claude/skills/`
- [ ] `bun` is installed and working
- [ ] Claude Code is open and ready
- [ ] Demo directory is clean (`~/demo-swig-app` has only `.env` and `.claude/`)

## 6. Demo Directory State

Before starting the demo, your directory should look like:

```
~/demo-swig-app/
├── .env
└── .claude/
    └── skills/
        └── swig-smart-wallet/
            └── SKILL.md
```

That's it. Claude Code will create everything else.
