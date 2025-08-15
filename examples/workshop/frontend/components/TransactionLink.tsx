import { formatSignature, getTransactionExplorerUrl } from '../lib/explorer';
import ExternalLinkIcon from './ExternalLinkIcon';

interface Props {
  signature: string;
  description?: string;
  className?: string;
}

export default function TransactionLink({
  signature,
  description,
  className = '',
}: Props) {
  return (
    <a
      href={getTransactionExplorerUrl(signature)}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-2 text-blue-600 hover:text-blue-700 ${className}`}
    >
      <span className="font-mono text-sm">{formatSignature(signature)}</span>
      <ExternalLinkIcon className="w-4 h-4" />
      {description && <span className="text-sm">({description})</span>}
    </a>
  );
}
