import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from '@tanstack/react-router';

export default function Header() {
  return (
    <header className="p-4 flex gap-2 items-center justify-between">
      <nav className="flex flex-row">
        <div className="px-2 font-bold flex items-center">
          <Link to="/">Home</Link>
        </div>
      </nav>
      <p className='text-2xl font-extrabold'>Swig x EVM Wallet Extension</p>
      <ConnectButton />
    </header>
  );
}
