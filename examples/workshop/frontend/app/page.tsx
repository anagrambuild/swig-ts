'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2 } from 'lucide-react';
import AccountCreator from '../components/AccountCreator';
import AccountFunder from '../components/AccountFunder';
import BackendRegistration from '../components/BackendRegistration';
import Dashboard from '../components/Dashboard';
import { useSwig } from '../hooks/useSwig';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3 | 4;

const steps = [
  { id: 1, name: 'Create', description: 'Create Swig Account' },
  { id: 2, name: 'Fund', description: 'Fund Account' },
  { id: 3, name: 'Register', description: 'Register with Backend' },
  { id: 4, name: 'Dashboard', description: 'View Dashboard' },
];

export default function Home() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const {
    account,
    loading,
    error,
    createAccount,
    fundAccount,
    delegateToBackend,
    getBalance,
    refreshSwig,
  } = useSwig();

  const [currentStep, setCurrentStep] = useState<Step>(1);

  const handleAccountCreated = () => {
    setCurrentStep(2);
  };

  const handleFunded = () => {
    setCurrentStep(3);
  };

  const handleRegistered = () => {
    setCurrentStep(4);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-slate-900 border-r-transparent"></div>
          <p className="mt-4 text-slate-600 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <header className="mb-12 text-center">
          <h1 className="text-5xl font-bold text-slate-900 mb-3 tracking-tight">
            Swig Workshop
          </h1>
          <p className="text-lg text-slate-600">
            Frontend-to-Backend Integration Demo
          </p>
        </header>

        {/* Progress Steps */}
        <div className="mb-12">
          <nav aria-label="Progress">
            <ol className="flex items-center justify-between">
              {steps.map((step, stepIdx) => (
                <li key={step.id} className="flex items-center flex-1">
                  <div className="flex items-center flex-1">
                    <div className="relative flex items-center">
                      <div
                        className={cn(
                          'flex h-12 w-12 items-center justify-center rounded-full border-2 transition-colors',
                          currentStep > step.id
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-600'
                            : currentStep === step.id
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-300 bg-white text-slate-400',
                        )}
                      >
                        {currentStep > step.id ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : (
                          <span className="text-sm font-semibold">
                            {step.id}
                          </span>
                        )}
                      </div>
                      <div className="ml-4 min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-sm font-medium',
                            currentStep >= step.id
                              ? 'text-slate-900'
                              : 'text-slate-500',
                          )}
                        >
                          {step.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {step.description}
                        </p>
                      </div>
                    </div>
                    {stepIdx < steps.length - 1 && (
                      <div
                        className={cn(
                          'mx-4 flex-1 h-0.5 transition-colors',
                          currentStep > step.id
                            ? 'bg-emerald-500'
                            : 'bg-slate-300',
                        )}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        <main className="space-y-8">
          {currentStep === 1 && (
            <AccountCreator
              account={account}
              loading={loading}
              error={error}
              createAccount={createAccount}
              getBalance={getBalance}
              refreshSwig={refreshSwig}
              onAccountCreated={handleAccountCreated}
            />
          )}

          {currentStep === 2 && (
            <AccountFunder
              account={account}
              loading={loading}
              error={error}
              fundAccount={fundAccount}
              getBalance={getBalance}
              onFunded={handleFunded}
            />
          )}

          {currentStep === 3 && (
            <BackendRegistration
              account={account}
              loading={loading}
              error={error}
              delegateToBackend={delegateToBackend}
              onRegistered={handleRegistered}
            />
          )}

          {currentStep === 4 && <Dashboard />}
        </main>
      </div>
    </div>
  );
}
