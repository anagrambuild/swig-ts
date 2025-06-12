import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import {
  useCreateSwig,
  useGenerate,
  useRequestAirdrop,
  useSwigAddres,
  useSwigBalance,
  useSwigTransfer,
} from '@/hooks';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

export function Swig() {
  const { swigTransferAsync } = useSwigTransfer();
  const { requestAirdropAsync } = useRequestAirdrop();
  const { createSwigAsync } = useCreateSwig();
  const { swigBalance } = useSwigBalance();
  const { generateId } = useGenerate();
  const { swigAddress } = useSwigAddres();

  const lamports = swigBalance ?? 0;
  const sol = (lamports / LAMPORTS_PER_SOL).toFixed(2);

  return (
    <Card className="max-w-3xl w-full">
      <CardHeader>Swig Address: {swigAddress?.toBase58() || '...'}</CardHeader>
      <CardContent className="space-y-4">
        <CardDescription className="text-6xl text-primary">
          {sol} <span className="text-xl">SOL</span>{' '}
        </CardDescription>
        <CardDescription>Swig Balance: {lamports} lamports</CardDescription>
      </CardContent>
      <CardFooter className="justify-center space-x-4">
        <Button variant={'secondary'} onClick={() => generateId()}>
          Generate new wallet
        </Button>
        <Button onClick={() => createSwigAsync()}>Create Swig</Button>
        <Button onClick={() => requestAirdropAsync()}>Request Airdrop</Button>
        <Button onClick={() => swigTransferAsync()}>Transfer 0.1 SOL</Button>
      </CardFooter>
    </Card>
  );
}
