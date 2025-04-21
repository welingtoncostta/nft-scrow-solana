import { PublicKey } from '@solana/web3.js';

export interface CompressedNftData {
  id: string;
  merkleTree: string;
  metadata: any;
  compression: {
    leaf_id: number;
    proofs: string[];
    root: string;
    creator_hash: string;
    data_hash: string;
    seq: number;
    enabled: boolean;
  };
}

export interface DasApiService {
  getCompressedNftsByOwner(owner: PublicKey): Promise<CompressedNftData[]>;
  getCompressedNftDetails(assetId: string): Promise<CompressedNftData>;
  getCompressedNftProof(assetId: string): Promise<{
    root: string;
    leaf_id: number;
    proof: string[];
    creator_hash: string;
    data_hash: string;
    tree?: string;
    seq?: number;
  }>;
}