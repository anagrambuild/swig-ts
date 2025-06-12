import { Swig } from '@/components/Swig';
import { createFileRoute } from '@tanstack/react-router';
import { useAccount } from 'wagmi';

export const Route = createFileRoute('/')({
  component: App,
});

function App() {
  const { isConnected } = useAccount();

  return (
    <div className="text-center flex flex-col items-center justify-center w-full p-4 mt-12">
      {isConnected ? <Swig /> : 'Connect EVM Wallet to interact with Swig'}
    </div>
  );
}
