import { WalletShell } from './components/WalletShell.tsx';
import { ConnectionPanel } from './components/dashboard/ConnectionPanel.tsx';
import { EmbeddedWalletCard } from './components/dashboard/EmbeddedWalletCard.tsx';
import { SwigOverviewCard } from './components/dashboard/SwigOverviewCard.tsx';
import { TransactionHistoryCard } from './components/dashboard/TransactionHistoryCard.tsx';
import { PermissionsPanel } from './components/dashboard/PermissionsPanel.tsx';
import { useConnection } from './hooks/useConnection.ts';
import { useEmbeddedKeypair } from './hooks/useEmbeddedKeypair.ts';
import { useRpcEndpoint } from './hooks/useRpcEndpoint.ts';
import { useSwigManager } from './hooks/useSwigManager.ts';
import { useTransactionHistory } from './hooks/useTransactionHistory.ts';

export default function App() {
  const { rpc, setRpc, resetRpc } = useRpcEndpoint();
  const { connection, status, latencyMs, error, refresh } = useConnection(rpc);
  const { keypair, publicKey, publicKeyBase58, secretBase64, regenerate } =
    useEmbeddedKeypair();
  const swigManager = useSwigManager(connection, keypair ?? null);
  const history = useTransactionHistory(
    connection,
    swigManager.reference?.address ?? null,
    12,
  );

  return (
    <WalletShell>
      <div className="space-y-8">
        <div className="grid gap-6 md:grid-cols-[1.05fr_1fr]">
          <ConnectionPanel
            rpc={rpc}
            status={status}
            latencyMs={latencyMs}
            error={error}
            onRpcChange={setRpc}
            onReset={resetRpc}
            onRefresh={refresh}
          />
          <EmbeddedWalletCard
            connection={connection}
            keypair={keypair}
            publicKey={publicKey ?? null}
            publicKeyBase58={publicKeyBase58}
            secretBase64={secretBase64}
            onRegenerate={regenerate}
            onResetSwig={swigManager.reset}
          />
        </div>
        <SwigOverviewCard
          connection={connection}
          manager={swigManager}
          onRefresh={() => {
            void history.refetch();
          }}
        />
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <TransactionHistoryCard
            entries={history.data}
            isLoading={history.isLoading}
            onRefresh={() => void history.refetch()}
          />
          <PermissionsPanel manager={swigManager} />
        </div>
      </div>
    </WalletShell>
  );
}
