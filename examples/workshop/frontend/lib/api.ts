import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface RegisterAccountRequest {
  swigAddress: string;
  userAddress: string;
  id: string;
}

export interface RegisterAccountResponse {
  success: boolean;
  message: string;
}

export interface TriggerActionRequest {
  swigAddress: string;
  action: string;
}

export interface TriggerActionResponse {
  success: boolean;
  transactionSignature?: string;
  message: string;
}

export interface AccountStatus {
  swigAddress: string;
  userAddress: string;
  id: string;
  balance: number;
  registeredAt: string;
  lastAction?: string;
}

export interface StatusResponse {
  accounts: AccountStatus[];
  totalAccounts: number;
  jobsRunning: boolean;
}

export interface BackendAddressResponse {
  success: boolean;
  backendAddress?: string;
  message?: string;
}

export const apiClient = {
  async registerAccount(
    data: RegisterAccountRequest,
  ): Promise<RegisterAccountResponse> {
    const response = await api.post('/api/accounts', data);
    return response.data;
  },

  async triggerAction(
    data: TriggerActionRequest,
  ): Promise<TriggerActionResponse> {
    const response = await api.post('/api/trigger', data);
    return response.data;
  },

  async getStatus(): Promise<StatusResponse> {
    const response = await api.get('/api/status');
    return response.data;
  },

  async getBackendAddress(): Promise<BackendAddressResponse> {
    const response = await api.get('/api/backend-address');
    return response.data;
  },
};
