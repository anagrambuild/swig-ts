export interface AdminDashboardProps {
  selectedLendingPermission: string[];
  setSelectedLendingPermission: (permission: string[]) => void;
  selectedDcaPermission: string[];
  setSelectedDcaPermission: (permission: string[]) => void;
  selectedTradingPermission: string[];
  setSelectedTradingPermission: (permission: string[]) => void;
  lendingSolRequired: number;
  setLendingSolRequired: (solRequired: number) => void;
  dcaSolRequired: number;
  setDcaSolRequired: (solRequired: number) => void;
  tradingSolRequired: number;
  setTradingSolRequired: (solRequired: number) => void;
  lendingTokens: string[];
  setLendingTokens: (tokens: string[]) => void;
  dcaTokens: string[];
  setDcaTokens: (tokens: string[]) => void;
  tradingTokens: string[];
  setTradingTokens: (tokens: string[]) => void;
}

export interface UserDashboardProps {
  requestPermission: (
    permissions: string[],
    solRequired: number,
    tokenAmounts: { token: string; amount: number }[]
  ) => void;
  loading: boolean;
  selectedLendingPermission: string[];
  selectedDcaPermission: string[];
  selectedTradingPermission: string[];
  lendingSolRequired: number;
  dcaSolRequired: number;
  tradingSolRequired: number;
  lendingTokens: string[];
  dcaTokens: string[];
  tradingTokens: string[];
  userLendingTokens: string[];
  setUserLendingTokens: (tokens: string[]) => void;
  userDcaTokens: string[];
  setUserDcaTokens: (tokens: string[]) => void;
  userTradingTokens: string[];
  setUserTradingTokens: (tokens: string[]) => void;
  userLendingTokenAmounts: { token: string; amount: number }[];
  handleLendingAmountChange: (token: string, value: string) => void;
  userDcaTokenAmounts: { token: string; amount: number }[];
  handleDcaAmountChange: (token: string, value: string) => void;
  userTradingTokenAmounts: { token: string; amount: number }[];
  handleTradingAmountChange: (token: string, value: string) => void;
}
