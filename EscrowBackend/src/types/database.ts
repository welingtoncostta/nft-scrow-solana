export interface NFTRecord {
  mint: string;
  owner: string;
  isCompressed: boolean;
  status: 'registered' | 'delegated' | 'in_escrow' | 'sold' | 'returned' | 'failed';
  batchId: string;
  metadata?: any;
  price?: number;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  errorMessage?: string;
  txId?: string;
}

export interface BatchRecord {
  id: string;
  owner: string;
  status: 'created' | 'signing' | 'delegated' | 'processing' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  totalNfts: number;
  processedNfts: number;
  errorMessage?: string;
  nfts?: NFTRecord[];
}

export interface TransactionRecord {
  id: string;
  batchId: string;
  signature: string;
  blockTime?: number;
  status: 'pending' | 'confirmed' | 'failed';
  confirmed: boolean;
  txIndex: number;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Database {
  // Batch operations
  createBatch(owner: string, batchId: string, totalNfts: number): Promise<BatchRecord>;
  getBatch(batchId: string): Promise<BatchRecord | null>;
  updateBatchStatus(batchId: string, status: BatchRecord['status'], errorMessage?: string): Promise<void>;
  getPendingBatches(): Promise<BatchRecord[]>;

  // NFT operations
  registerNft(nft: Partial<NFTRecord>): Promise<NFTRecord>;
  getNft(mint: string, batchId: string): Promise<NFTRecord | null>;
  updateNftStatus(batchId: string, mint: string, status: NFTRecord['status'], txId?: string, errorMessage?: string): Promise<void>;
  updateNftStatusForBatch(batchId: string, status: NFTRecord['status']): Promise<void>;
  getFailedNftCount(batchId: string): Promise<number>;

  // Transaction operations
  storeTransaction(batchId: string, signature: string, txIndex: number): Promise<TransactionRecord>;
  getBatchTransactions(batchId: string): Promise<TransactionRecord[]>;
  updateTransactionStatus(signature: string, status: TransactionRecord['status'], confirmed: boolean, errorMessage?: string): Promise<void>;
}