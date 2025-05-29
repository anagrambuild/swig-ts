/* eslint-disable @typescript-eslint/no-unused-vars */
import Anthropic from '@anthropic-ai/sdk';
import { ActionResult, SolanaSwigActions } from './plugins/solana-swig/actions';
import { SolanaService } from './plugins/solana-swig/service';

export interface AgentConfig {
  anthropicApiKey: string;
  solanaRpcUrl?: string;
}

export class SolanaSwigAgent {
  private anthropic: Anthropic;
  private solanaService: SolanaService;
  private actions: SolanaSwigActions;

  constructor(config: AgentConfig) {
    this.anthropic = new Anthropic({
      apiKey: config.anthropicApiKey,
    });

    // Create a mock runtime for the SolanaService
    const mockRuntime = {} as any;
    this.solanaService = SolanaService.getInstance(mockRuntime);
    this.actions = new SolanaSwigActions(this.solanaService);
  }

  async processMessage(message: string): Promise<string> {
    try {
      // Analyze the message to determine what action to take
      const actionPlan = await this.analyzeMessage(message);

      if (actionPlan.action === 'none') {
        return actionPlan.response;
      }

      // Execute the action
      const result = await this.executeAction(
        actionPlan.action,
        actionPlan.parameters,
      );

      // Generate a response based on the result
      return await this.generateResponse(message, result);
    } catch (error) {
      return `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async analyzeMessage(message: string): Promise<{
    action: string;
    parameters: any;
    response: string;
  }> {
    const prompt = `You are a Solana and Swig wallet AI agent. Analyze the following user message and determine what action to take.

Available actions:
- create_keypair: Create a new Solana keypair
- request_airdrop: Request SOL airdrop (requires amount)
- mint_spl_token: Mint a new SPL token (requires decimals, initialSupply)
- check_balance: Check wallet balance
- transfer_sol: Transfer SOL from main wallet (requires to, amount)
- transfer_spl_token: Transfer SPL tokens from main wallet (requires to, amount, mint)
- create_swig_wallet: Create a new Swig wallet
- get_swig_wallets: Get all Swig wallets
- transfer_to_swig: Transfer to a Swig wallet from main wallet (requires swigAddress, amount, optional mint)
- swig_transfer: Transfer from a Swig wallet to any destination (requires swigAddress, to, amount, optional mint)
- none: No action needed, just respond conversationally

User message: "${message}"

IMPORTANT: Pay attention to the direction of transfers:
- "Send X SOL to address" = transfer_sol (from main wallet)
- "Transfer X SOL from swig [address] to [destination]" = swig_transfer
- "Send X SOL from my swig wallet to [destination]" = swig_transfer (use first available swig)
- "Move X SOL from swig to [destination]" = swig_transfer

For swig_transfer actions, you need:
- swigAddress: the source Swig wallet address
- to: the destination address
- amount: the amount to transfer
- mint: (optional) for SPL token transfers

If the user says "from my swig wallet" without specifying which one, set swigAddress to "auto" and the system will use the first available Swig wallet.

Respond with a JSON object containing:
- action: the action to take
- parameters: object with required parameters for the action
- response: if action is "none", provide a conversational response

Examples:
- "Create a new wallet" -> {"action": "create_keypair", "parameters": {}, "response": ""}
- "Send 0.1 SOL to ABC123" -> {"action": "transfer_sol", "parameters": {"to": "ABC123", "amount": 0.1}, "response": ""}
- "Transfer 0.5 SOL from swig DEF456 to ABC123" -> {"action": "swig_transfer", "parameters": {"swigAddress": "DEF456", "to": "ABC123", "amount": 0.5}, "response": ""}
- "Send 0.2 SOL from my swig wallet to XYZ789" -> {"action": "swig_transfer", "parameters": {"swigAddress": "auto", "to": "XYZ789", "amount": 0.2}, "response": ""}
- "What's my balance?" -> {"action": "check_balance", "parameters": {}, "response": ""}
- "Hello" -> {"action": "none", "parameters": {}, "response": "Hello! I'm your Solana and Swig wallet assistant. I can help you create wallets, check balances, transfer tokens, and manage Swig wallets. What would you like to do?"}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    try {
      const content = response.content[0];
      if (content.type === 'text') {
        return JSON.parse(content.text);
      }
      throw new Error('Unexpected response format');
    } catch (error) {
      return {
        action: 'none',
        parameters: {},
        response:
          "I'm sorry, I didn't understand that. Could you please rephrase your request?",
      };
    }
  }

  private async executeAction(
    action: string,
    parameters: any,
  ): Promise<ActionResult> {
    switch (action) {
      case 'create_keypair':
        return await this.actions.createKeypair();

      case 'request_airdrop':
        return await this.actions.requestAirdrop(parameters);

      case 'mint_spl_token':
        return await this.actions.mintSplToken(parameters);

      case 'check_balance':
        return await this.actions.checkWalletBalance();

      case 'transfer_sol':
        return await this.actions.transferSol(parameters);

      case 'transfer_spl_token':
        return await this.actions.transferSplToken(parameters);

      case 'create_swig_wallet':
        return await this.actions.createSwigWallet();

      case 'get_swig_wallets':
        return await this.actions.getSwigWallets();

      case 'transfer_to_swig':
        return await this.actions.transferToSwig(parameters.swigAddress, {
          to: parameters.swigAddress,
          amount: parameters.amount,
          mint: parameters.mint,
        });

      case 'swig_transfer': {
        // Handle auto-selection of Swig wallet
        let swigAddress = parameters.swigAddress;
        if (swigAddress === 'auto') {
          const swigWallets = await this.solanaService.getSwigWallets();
          if (swigWallets.length === 0) {
            return {
              success: false,
              message:
                'No Swig wallets found. Please create a Swig wallet first.',
            };
          }
          swigAddress = swigWallets[0].address;
        }

        return await this.actions.swigTransfer({
          swigAddress,
          to: parameters.to,
          amount: parameters.amount,
          mint: parameters.mint,
        });
      }

      default:
        return {
          success: false,
          message: `Unknown action: ${action}`,
        };
    }
  }

  private async generateResponse(
    originalMessage: string,
    actionResult: ActionResult,
  ): Promise<string> {
    const prompt = `You are a helpful Solana and Swig wallet AI agent. A user asked: "${originalMessage}"

The action was executed with the following result:
- Success: ${actionResult.success}
- Message: ${actionResult.message}
- Data: ${JSON.stringify(actionResult.data, null, 2)}

Generate a friendly, informative response to the user about what happened. Be conversational and helpful.`;

    const response = await this.anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }

    return actionResult.message;
  }

  async getWalletInfo(): Promise<string> {
    try {
      const walletInfo = await this.solanaService.getWalletInfo();
      const swigWallets = await this.solanaService.getSwigWallets();

      let response = `🔑 **Main Wallet**\n`;
      response += `Address: ${walletInfo.publicKey}\n`;
      response += `Balance: ${walletInfo.balance} SOL\n\n`;

      if (swigWallets.length > 0) {
        response += `🏦 **Swig Wallets** (${swigWallets.length})\n`;
        swigWallets.forEach((swig, index) => {
          response += `${index + 1}. ${swig.address} - ${swig.balance} SOL\n`;
          if (swig.tokens.length > 0) {
            response += `   Tokens: ${swig.tokens.length}\n`;
          }
        });
      } else {
        response += `🏦 **Swig Wallets**: None created yet\n`;
      }

      return response;
    } catch (error) {
      return `Error getting wallet info: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}
