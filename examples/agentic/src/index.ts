#!/usr/bin/env bun
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as readline from 'readline';
import { SolanaSwigAgent } from './agent';

async function main() {
  console.log('🤖 Solana Swig AI Agent Starting...\n');

  // Check for required environment variables
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    console.error(
      '❌ Error: ANTHROPIC_API_KEY environment variable is required',
    );
    console.log('Please set your Anthropic API key:');
    console.log('export ANTHROPIC_API_KEY="your-api-key-here"');
    process.exit(1);
  }

  // Initialize the agent
  const agent = new SolanaSwigAgent({
    anthropicApiKey,
    solanaRpcUrl: process.env.SOLANA_RPC_URL || 'http://localhost:8899',
  });

  console.log('✅ Agent initialized successfully!');
  console.log(
    '🔗 Connected to Solana RPC:',
    process.env.SOLANA_RPC_URL || 'http://localhost:8899',
  );
  console.log('\n📋 Available commands:');
  console.log('  - "wallet info" - Show wallet information');
  console.log('  - "create wallet" - Create a new keypair');
  console.log('  - "check balance" - Check current balance');
  console.log('  - "airdrop 1" - Request 1 SOL airdrop');
  console.log('  - "create swig" - Create a new Swig wallet');
  console.log('  - "list swigs" - List all Swig wallets');
  console.log('  - "mint token" - Mint a new SPL token');
  console.log('  - "help" - Show this help message');
  console.log('  - "exit" - Exit the program');
  console.log('\n💬 You can also ask questions in natural language!');
  console.log('📤 Transfer Examples:');
  console.log('  - "Send 0.1 SOL to [address]" (from main wallet)');
  console.log('  - "Transfer 0.5 SOL to my swig wallet"');
  console.log('  - "Send 0.2 SOL from my swig wallet to [address]"');
  console.log('  - "Transfer 0.3 SOL from swig [address] to [destination]"');
  console.log('💡 Other Examples:');
  console.log('  - "What is my balance?" or "Show me my wallets"');
  console.log('  - "Create a new Swig wallet with spending limits"');
  console.log('  - "Mint a token with 9 decimals and 1000 supply"\n');

  // Create readline interface
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: '🤖 Agent> ',
  });

  // Show initial wallet info
  try {
    const walletInfo = await agent.getWalletInfo();
    console.log('📊 Current Status:');
    console.log(walletInfo);
    console.log();
  } catch (_error) {
    console.log(
      '⚠️  Could not fetch initial wallet info. This is normal on first run.',
    );
    console.log();
  }

  rl.prompt();

  rl.on('line', async (input) => {
    const message = input.trim();

    if (message === 'exit' || message === 'quit') {
      console.log('👋 Goodbye!');
      rl.close();
      process.exit(0);
    }

    if (message === 'help') {
      console.log('\n📋 Available commands:');
      console.log('  - "wallet info" - Show wallet information');
      console.log('  - "create wallet" - Create a new keypair');
      console.log('  - "check balance" - Check current balance');
      console.log('  - "airdrop 1" - Request 1 SOL airdrop');
      console.log('  - "create swig" - Create a new Swig wallet');
      console.log('  - "list swigs" - List all Swig wallets');
      console.log('  - "mint token" - Mint a new SPL token');
      console.log('  - "help" - Show this help message');
      console.log('  - "exit" - Exit the program');
      console.log('\n💬 You can also ask questions in natural language!');
      console.log('📤 Transfer Examples:');
      console.log('  - "Send 0.1 SOL to [address]" (from main wallet)');
      console.log('  - "Transfer 0.5 SOL to my swig wallet"');
      console.log('  - "Send 0.2 SOL from my swig wallet to [address]"');
      console.log(
        '  - "Transfer 0.3 SOL from swig [address] to [destination]"',
      );
      console.log('💡 Other Examples:');
      console.log('  - "What is my balance?" or "Show me my wallets"');
      console.log('  - "Create a new Swig wallet with spending limits"');
      console.log('  - "Mint a token with 9 decimals and 1000 supply"\n');
      rl.prompt();
      return;
    }

    if (message === 'wallet info') {
      try {
        const walletInfo = await agent.getWalletInfo();
        console.log('\n📊 Wallet Information:');
        console.log(walletInfo);
      } catch (error) {
        console.log(
          '❌ Error getting wallet info:',
          error instanceof Error ? error.message : 'Unknown error',
        );
      }
      console.log();
      rl.prompt();
      return;
    }

    if (message === '') {
      rl.prompt();
      return;
    }

    try {
      console.log('\n🤔 Processing your request...');
      const response = await agent.processMessage(message);
      console.log('🤖 Agent:', response);
    } catch (error) {
      console.log(
        '❌ Error:',
        error instanceof Error ? error.message : 'Unknown error',
      );
    }

    console.log();
    rl.prompt();
  });

  rl.on('close', () => {
    console.log('\n👋 Goodbye!');
    process.exit(0);
  });

  // Handle Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n👋 Goodbye!');
    process.exit(0);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

main().catch((error) => {
  console.error('Failed to start agent:', error);
  process.exit(1);
});
