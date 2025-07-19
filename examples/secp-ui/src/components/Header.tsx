import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Link } from '@tanstack/react-router';

export default function Header() {
  return (
    <header className="p-4 flex gap-2 items-center justify-between">
      <p className="text-xl font-extrabold">Swig x Secp</p>
      <nav className="flex flex-row">
        <div className="px-2 space-x-8 flex items-center">
          <Link className="hover:text-muted-foreground" to="/">
            EVM
          </Link>
          <Link className="hover:text-muted-foreground" to="/passkey">
            Passkey
          </Link>
        </div>
      </nav>
      <ConnectButton />
    </header>
  );
}
