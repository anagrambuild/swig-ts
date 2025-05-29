# Solana Swig AI Agent

An AI-powered agent that can interact with Solana blockchain and manage Swig wallets using natural language commands.

## Features

- 🤖 **Natural Language Interface**: Interact with Solana and Swig using conversational commands
- 🔑 **Wallet Management**: Create keypairs, check balances, and manage multiple wallets
- 💰 **Solana Operations**: Request airdrops, transfer SOL, mint SPL tokens
- 🏦 **Swig Wallet Integration**: Create and manage Swig wallets with role-based permissions
- 🔄 **Smart Transfers**: Transfer assets to/from Swig wallets with proper authorization
- 🧠 **AI-Powered**: Uses Anthropic's Claude to understand and execute commands

## Prerequisites

- [Bun](https://bun.sh/) runtime
- Local Solana validator running on `http://localhost:8899`
- Anthropic API key

## Setup

1. **Install dependencies:**

   ```bash
   bun install
   ```

2. **Set up environment variables:**

   ```bash
   export ANTHROPIC_API_KEY="your-anthropic-api-key-here"
   export SOLANA_RPC_URL="http://localhost:8899"  # Optional, defaults to localhost
   ```

3. **Start local Solana validator:**
   ```bash
   solana-test-validator
   ```

## Usage

### Start the Agent

```bash
bun run dev
# or
bun src/index.ts
```

### Available Commands

#### Direct Commands

- `wallet info` - Show current wallet information
- `create wallet` - Create a new Solana keypair
- `check balance` - Check current wallet balance
- `airdrop 1` - Request 1 SOL airdrop
- `create swig` - Create a new Swig wallet
- `list swigs` - List all Swig wallets
- `mint token` - Mint a new SPL token
- `help` - Show help message
- `exit` - Exit the program

#### Natural Language Commands

You can also use natural language to interact with the agent:

**Wallet Operations:**

- "What's my balance?"
- "Show me all my wallets"
- "Create a new Swig wallet"

**Transfers from Main Wallet:**

- "Send 0.1 SOL to [address]"
- "Transfer 0.5 SOL to my swig wallet"
- "Send tokens to [address]"

**Transfers from Swig Wallets:**

- "Send 0.2 SOL from my swig wallet to [address]"
- "Transfer 0.3 SOL from swig [swig-address] to [destination]"
- "Move 0.1 SOL from my swig to my main wallet"

**Token Operations:**

- "Mint a new token with 9 decimals and 1000 initial supply"
- "Transfer tokens from swig wallet to [address]"

## Architecture

### Core Components

- **`SolanaService`**: Handles all Solana blockchain interactions
- **`SolanaSwigActions`**: Provides structured action results for operations
- **`SolanaSwigAgent`**: AI agent that processes natural language and executes actions
- **Providers**: Data providers for wallet, balance, and Swig information

### Swig Integration

The agent uses the Swig SDK to:

- Create Swig wallets with role-based permissions
- Manage authorities and spending limits
- Execute transfers using proper Swig authorization
- Check role permissions before operations

### AI Processing

The agent uses Anthropic's Claude to:

1. Analyze user messages and determine required actions
2. Extract parameters from natural language
3. Generate helpful responses based on operation results

## Example Interactions

```
🤖 Agent> create swig
🤔 Processing your request...
🤖 Agent: Great! I've successfully created a new Swig wallet for you.

The new Swig wallet address is: 8x7v2...

This wallet has been set up with full permissions for your current keypair. You can now transfer SOL or tokens to this Swig wallet, and use it to make authorized transfers with role-based spending controls.

🤖 Agent> send 0.1 sol to 8x7v2...
🤔 Processing your request...
🤖 Agent: Perfect! I've successfully sent 0.1 SOL to the Swig wallet.

Transaction signature: 3k9m1...
The transfer has been confirmed on the blockchain.

🤖 Agent> send 0.05 sol from my swig wallet to 9y8w3...
🤔 Processing your request...
🤖 Agent: Excellent! I've successfully transferred 0.05 SOL from your Swig wallet to the destination address.

The Swig wallet had the proper authorization to make this transfer. Transaction signature: 4l0n2...
Your Swig wallet balance has been updated accordingly.
```

## Development

### Build

```bash
bun run build
```

### Watch Mode

```bash
bun run dev
```

### Clean

```bash
bun run clean
```

## Technical Details

### Swig Wallet Operations

The agent implements proper Swig wallet functionality including:

- **Role-based Authorization**: Each operation checks if the current keypair has the required permissions
- **Spending Limits**: SOL and token transfers respect role-based spending limits
- **Proper Signing**: Uses Swig SDK's `signInstruction` for authorized operations
- **Authority Management**: Supports creating wallets with different permission levels
- **Bidirectional Transfers**: Supports both transfers TO and FROM Swig wallets
- **Auto-Selection**: Can automatically select the first available Swig wallet when user says "my swig wallet"

### Transfer Types Supported

**1. Main Wallet → Any Destination**

- Standard Solana transfers using the main keypair
- Example: "Send 0.1 SOL to [address]"

**2. Main Wallet → Swig Wallet**

- Transfers from main wallet to fund Swig wallets
- Example: "Transfer 0.5 SOL to my swig wallet"

**3. Swig Wallet → Any Destination**

- Authorized transfers from Swig wallets using role-based permissions
- Checks spending limits and role authorization before execution
- Example: "Send 0.2 SOL from my swig wallet to [address]"

**4. Swig Wallet → Main Wallet**

- Transfers from Swig back to the main wallet
- Example: "Move 0.1 SOL from swig to my main wallet"

### Error Handling

The agent provides helpful error messages for common issues:

- Insufficient permissions for Swig operations
- Invalid addresses or amounts
- Network connectivity issues
- Missing required parameters

## Limitations

- SPL token transfers from Swig wallets require additional implementation
- Currently uses a single keypair for demo purposes
- Requires local Solana validator for testing

## Contributing

This is an example implementation demonstrating Swig SDK integration with AI agents. Feel free to extend and modify for your use cases.
