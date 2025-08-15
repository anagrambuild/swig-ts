import Head from 'next/head';
import { useEffect, useState } from 'react';
import AccountCreator from '../components/AccountCreator';
import AccountFunder from '../components/AccountFunder';
import BackendRegistration from '../components/BackendRegistration';
import Dashboard from '../components/Dashboard';
// STEP 0: Import the main Swig hook that provides wallet and account management
import { useSwig } from '../hooks/useSwig';

export default function Home() {
  // STEP 0: Set up workshop state management
  const [step, setStep] = useState(1);
  // STEP 0: Initialize Swig hook - this provides all wallet and account functionality
  const swigState = useSwig();
  const { account, getBalance, refreshSwig } = swigState;

  // STEP 0: Auto-advance workshop steps based on account state
  useEffect(() => {
    const checkStepProgression = async () => {
      if (!account) {
        setStep(1); // STEP 1: Account creation needed
        return;
      }

      // STEP 1 complete: Account exists, advance to step 2
      if (step < 2) {
        setStep(2);
      }

      // STEP 2 complete: Check if account is funded (>0.5 SOL), advance to step 3
      const balance = await getBalance();
      if (balance > 500000000 && step < 3) {
        // 0.5 SOL in lamports
        setStep(3);
      }
    };

    checkStepProgression();
  }, [account, step, getBalance]);

  return (
    <>
      <Head>
        <title>Swig Workshop - Frontend to Backend Integration</title>
        <meta
          name="description"
          content="Learn how to integrate Swig with frontend and backend applications"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-8">
          <header className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">
              Swig Workshop
            </h1>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Learn how to integrate Swig wallet delegation into your dApp with
              frontend account creation and backend automation
            </p>
          </header>

          <div className="max-w-4xl mx-auto space-y-8">
            {/* Workshop Step Components */}
            {/* STEP 1: Create Swig Account - First step in the tutorial */}
            <AccountCreator
              account={account}
              loading={swigState.loading}
              error={swigState.error}
              createAccount={swigState.createAccount}
              getBalance={getBalance}
              refreshSwig={refreshSwig}
              onAccountCreated={() => {
                console.log('onAccountCreated');
                setStep(2);
              }}
            />

            {/* STEP 2: Fund Account - Add SOL to enable transactions */}
            <AccountFunder
              account={account}
              loading={swigState.loading}
              error={swigState.error}
              fundAccount={swigState.fundAccount}
              getBalance={getBalance}
              onFunded={() => setStep(Math.max(step, 3))}
            />

            {/* STEP 3: Delegate to Backend - Enable backend automation */}
            <BackendRegistration
              account={account}
              loading={swigState.loading}
              error={swigState.error}
              delegateToBackend={swigState.delegateToBackend}
              refreshSwig={refreshSwig}
              onRegistered={() => setStep(4)}
            />

            {/* STEP 4: Dashboard - Monitor backend automation and account activity */}
            {step >= 4 && (
              <div className="mt-12">
                <Dashboard />
              </div>
            )}
          </div>

          <footer className="text-center mt-16 text-gray-500 text-sm">
            <p>
              This is a demo application showing Swig integration patterns. Make
              sure your local Solana validator is running on localhost:8899
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}
