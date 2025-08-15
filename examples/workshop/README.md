# Swig Workshop: Frontend to Backend Integration

This workshop demonstrates how to integrate Swig wallet delegation into a full-stack dApp with frontend account creation and backend automation.

## Overview

The workshop consists of:

- **Frontend**: NextJS application for user interaction
- **Backend**: Fastify API server with automated jobs
- **Demo Flow**: Account creation → funding → delegation → automation

## Prerequisites

1. **Node.js** (v18+) and **Bun** installed
2. **Solana CLI** installed
3. **Local Solana validator** running

## Setup

⚠️ **Important**: You need to run the Solana validator in a separate terminal before starting the workshop services.

### 1. Start Local Solana Validator (Terminal 1)

```bash
# In the root swig-ts directory
cd examples/kit/transfer
bun start-validator
```

This starts a local Solana validator on `localhost:8899` with the Swig program deployed.
**Keep this running throughout the workshop.**

### 2. Start Backend Server (Terminal 2)

```bash
cd examples/workshop/backend
bun install
bun dev
```

The backend will start on `http://localhost:3001` and automatically:

- Initialize a backend keypair for delegation
- Start automated jobs that run every 30 seconds
- Log all activities with colored output

### 3. Start Frontend Application (Terminal 3)

```bash
cd examples/workshop/frontend
bun install
bun dev
```

The frontend will start on `http://localhost:3000`.

## Workshop Steps

### Step 1: Create Swig Account (Frontend)

- Click "Create Swig Account" to generate a new Swig account
- The account is created with full permissions for the user
- A manager authority is added for delegation management
- ✨ **UI automatically progresses to step 2 when complete**
- 🔗 **All transactions wait for finalized status to prevent simulation failures**

### Step 2: Fund Account (Frontend)

- Add SOL to the Swig account using the funding interface
- This gives the account balance to perform transactions
- The backend will need funds to execute automated actions
- ✨ **UI automatically progresses to step 3 when complete**
- 🔗 **Airdrop waits for finalized status before proceeding**

### Step 3: Register with Backend (Frontend)

- Register the account with the backend API
- Delegate limited permissions (0.1 SOL spending limit) to the backend
- The account is stored in the backend's memory store
- ✨ **Dashboard becomes available when complete**
- 🔗 **Delegation transaction waits for finalized status**

### Step 4: View Dashboard (Frontend)

- Monitor all registered accounts and their balances
- Trigger manual actions via the dashboard
- Watch real-time updates from automated jobs
- 🔄 **Auto-refreshes every 5 seconds**

### Step 5: Automated Actions (Backend)

- The backend automatically performs actions every 30 seconds
- 🔗 **All automated transactions wait for finalized status**
- Actions include small SOL transfers (0.01 SOL each)
- All actions respect the delegation limits set by users

## Architecture

### Frontend (NextJS)

```
frontend/
├── components/
│   ├── AccountCreator.tsx     # Step 1: Create accounts
│   ├── AccountFunder.tsx      # Step 2: Fund accounts
│   ├── BackendRegistration.tsx # Step 3: Register & delegate
│   └── Dashboard.tsx          # Step 4: Monitor & control
├── hooks/
│   └── useSwig.ts            # Swig integration logic
├── lib/
│   ├── api.ts                # Backend API client
│   ├── solana.ts             # Solana connection utils
│   └── transactions.ts       # Transaction helpers
└── pages/
    └── index.tsx             # Main application page
```

### Backend (Fastify)

```
backend/
├── routes/
│   └── accounts.ts           # Account & action endpoints
├── services/
│   ├── swig.ts              # Swig transaction service
│   ├── solana.ts            # Solana connection
│   └── scheduler.ts         # Automated job scheduler
├── store/
│   └── memory.ts            # In-memory account store
└── server.ts                # Main server setup
```

## Key Features Demonstrated

1. **Account Creation**: Using `@swig-wallet/kit` to create accounts
2. **Role Management**: Adding authorities with specific permissions
3. **Delegation**: Granting limited spending authority to backend
4. **Real-time Updates**: Live balance and transaction monitoring
5. **Automated Jobs**: Background tasks with delegation
6. **Error Handling**: Proper error handling and user feedback

## API Endpoints

- `POST /api/accounts` - Register a Swig account
- `POST /api/trigger` - Trigger manual action
- `GET /api/status` - Get account status and job info
- `GET /health` - Health check

## Security Notes

- Backend has limited delegation (0.1 SOL max spend)
- All transactions respect Swig's permission system
- Private keys never leave their respective environments
- Accounts can revoke backend permissions at any time

## Troubleshooting

### Validator Issues

- Ensure validator is running: `curl http://localhost:8899 -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"getVersion"}'`
- Reset if needed: `solana-test-validator --reset`

### Transaction Failures

- Check account balances are sufficient
- Verify delegation permissions are set correctly
- Look for detailed error logs in backend console

### Frontend Connection Issues

- Ensure backend is running on port 3001
- Check CORS configuration if needed
- Verify API URLs in frontend configuration

## Next Steps

After completing the workshop:

1. Extend with more complex automated strategies
2. Add token operations beyond SOL transfers
3. Implement more sophisticated permission models
4. Add persistent storage instead of in-memory
5. Deploy to production environments

## Support

For issues or questions:

- Check the Swig documentation
- Review example code in `/examples/kit/transfer/`
- Look at existing test suites for patterns
