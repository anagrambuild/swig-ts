import type { Network } from '../types.js';

export interface SponsorRequest {
  /** Base58-encoded serialized transaction */
  base58_encoded_transaction: string;
  /** Network to use (defaults to 'mainnet') */
  network?: Network;
}

export interface SignRequest {
  /** Base58-encoded serialized transaction */
  base58_encoded_transaction: string;
  /** Network to use (defaults to 'mainnet') */
  network?: Network;
}

export interface SponsorResponse {
  /** Unique request ID for tracking */
  request_id: string;
  /** Transaction signature */
  signature: string;
  /** Amount of lamports spent by the paymaster */
  spent_by_paymaster: number;
}

export interface SignResponse {
  /** Unique request ID for tracking */
  request_id: string;
  /** Base58-encoded signed transaction */
  signed_transaction: string;
}

export interface ServiceStatus {
  /** Service status */
  status: string;
  /** Optional status message */
  message?: string;
}

export interface HealthResponse {
  /** Overall service status */
  status: 'healthy' | 'degraded';
  /** Timestamp of the health check */
  timestamp: string;
}
