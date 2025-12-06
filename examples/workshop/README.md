# Swig Workshop: Frontend-to-Backend Integration Demo

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

- **Pages**: Main dashboard with step-by-step workflow
- **Components**: AccountCreator, AccountFunder, BackendRegistration, Dashboard
- **Hooks**: useSwig hook for Swig account management
- **Lib**: Solana connection and transaction utilities

### Backend (Fastify)

- **Routes**: Account registration and management endpoints
- **Services**: SwigService for transaction execution, Scheduler for automation
- **Store**: In-memory account storage

## Key Features

1. **Seamless Integration**: Easy to add Swig to existing apps
2. **Delegation Power**: Backend can act on user's behalf without private keys
3. **Real-time Updates**: Frontend shows live transaction results
4. **Automation**: Backend jobs work autonomously once set up
5. **Spending Limits**: Backend actions respect delegated limits (0.1 SOL)

## Troubleshooting

- **Validator not running**: Ensure the Solana validator is running on port 8899
- **Backend connection failed**: Check that the backend is running on port 3001
- **Transaction failures**: Ensure transactions wait for finalized status (they do by default)
- **Balance not updating**: Check that the validator is processing transactions

## Development

### Frontend Development

```bash
cd examples/workshop/frontend
bun dev
```

### Backend Development

```bash
cd examples/workshop/backend
bun dev
```

## Environment Variables

### Frontend (.env.local)

```
NEXT_PUBLIC_RPC_URL=http://localhost:8899
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Backend (.env)

```
SOLANA_RPC_URL=http://localhost:8899
PORT=3001
```
