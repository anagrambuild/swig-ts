#!/usr/bin/env bun

/**
 * Example script demonstrating the Solana Swig AI Agent functionality
 *
 * This script shows how to:
 * 1. Initialize the agent
 * 2. Process natural language commands
 * 3. Interact with Solana and Swig wallets
 */

import { SolanaSwigAgent } from './src/agent';

async function runExample() {
  console.log('🚀 Solana Swig AI Agent Example\n');

  // Check for API key
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    console.error('❌ Please set ANTHROPIC_API_KEY environment variable');
    process.exit(1);
  }

  // Initialize the agent
  const agent = new SolanaSwigAgent({
    anthropicApiKey,
    solanaRpcUrl: 'http://localhost:8899',
  });

  console.log('✅ Agent initialized\n');

  // Example commands to demonstrate functionality
  const commands = [
    "What's my current wallet balance?",
    'Request an airdrop of 2 SOL',
    'Create a new Swig wallet',
    'Transfer 0.5 SOL to my swig wallet',
    'Show me my wallet information',
    'Send 0.2 SOL from my swig wallet to my main wallet',
  ];

  for (const command of commands) {
    console.log(`🗣️  User: "${command}"`);
    console.log('🤔 Processing...');

    try {
      const response = await agent.processMessage(command);
      console.log(`🤖 Agent: ${response}`);
    } catch (error) {
      console.log(
        `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    console.log(''); // Empty line for readability

    // Small delay between commands
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log('✨ Example completed!');
}

// Run the example
runExample().catch((error) => {
  console.error('Failed to run example:', error);
  process.exit(1);
});
