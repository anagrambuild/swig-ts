import { PasskeySwig } from '@/components/PasskeySwig';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/passkey')({
  component: App,
});

function App() {
  return (
    <div className="text-center flex flex-col items-center justify-center w-full p-4 mt-12">
      {<PasskeySwig />}
    </div>
  );
}
