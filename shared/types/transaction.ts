// Shared blockchain transaction types

export interface TransactionStatus {
  status: 'pending' | 'success' | 'failed';
  hash?: string;
  ledger?: number;
  timestamp?: string;
  error?: string;
}

export interface DepositTransaction {
  type: 'deposit';
  vaultId: string;
  userAddress: string;
  amount: number;
  assetCode: string;
  sharesReceived?: number;
  status: TransactionStatus;
}

export interface WithdrawTransaction {
  type: 'withdraw';
  vaultId: string;
  userAddress: string;
  shares: number;
  amountReceived?: number;
  assetCode: string;
  status: TransactionStatus;
}

export interface RebalanceTransaction {
  type: 'rebalance';
  vaultId: string;
  triggeredBy: 'rule' | 'manual';
  ruleId?: string;
  fromAllocations: { assetCode: string; amount: number }[];
  toAllocations: { assetCode: string; amount: number }[];
  status: TransactionStatus;
  gasUsed?: number;
}

export interface DeploymentTransaction {
  type: 'deployment';
  vaultId: string;
  owner: string;
  contractAddress?: string;
  wasmHash?: string;
  status: TransactionStatus;
  gasUsed?: number;
}

export type VaultTransaction =
  | DepositTransaction
  | WithdrawTransaction
  | RebalanceTransaction
  | DeploymentTransaction;

export interface TransactionHistory {
  vaultId: string;
  transactions: VaultTransaction[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface GasEstimate {
  estimatedFee: number;
  estimatedGasUnits: number;
  networkCongestion: 'low' | 'medium' | 'high';
}

export interface TransactionReceipt {
  hash: string;
  ledger: number;
  timestamp: string;
  successful: boolean;
  operations: any[];
  feeBump?: boolean;
  innerTransaction?: any;
}
