import {
  AddressLookupTableProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import { Program } from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createApproveInstruction } from '@solana/spl-token';
import { chunk } from 'lodash';
import PQueue from 'p-queue';
import { Database } from '../types/database';
import { DasApiService } from '../types/dasApi';
import { 
  BUBBLEGUM_PROGRAM_ID,
  SPL_ACCOUNT_COMPRESSION_PROGRAM_ID,
  SPL_NOOP_PROGRAM_ID,
  SYSVAR_RENT_PUBKEY,
  TOKEN_METADATA_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  MAX_NFTS_PER_TRANSACTION,
  MAX_RETRY_COUNT,
  RETRY_DELAY_BASE_MS
} from '../utils/constants';
import { decodeMetadata } from '../utils/metadata';
import BN from 'bn.js';

// ATENÇÃO: Certifique-se de importar ou definir o 'idl' do Anchor para o seu programa
// import idl from '../path/to/idl.json';

export class EscrowService {
  private program: Program;
  private connection: Connection;
  private adminKeypair: Keypair;
  private db: Database;
  private dasApi: DasApiService;
  private readonly MAX_NFTS_PER_TX = MAX_NFTS_PER_TRANSACTION;

  constructor(
    connection: Connection,
    programId: PublicKey,
    adminKeypair: Keypair,
    db: Database,
    dasApi: DasApiService
  ) {
    this.connection = connection;
    this.adminKeypair = adminKeypair;
    this.db = db;
    this.dasApi = dasApi;
    this.program = new Program(idl, programId, { connection });
  }

  async verifyNftOwnership(
    owner: PublicKey,
    nftAddresses: string[]
  ): Promise<{
    valid: Array<{ mint: string, isCompressed: boolean }>,
    invalid: string[]
  }> {
    const valid: Array<{ mint: string, isCompressed: boolean }> = [];
    const invalid: string[] = [];

    const batches = chunk(nftAddresses, 50);

    for (const batch of batches) {
      const tokenAccounts = await this.connection.getParsedTokenAccountsByOwner(
        owner,
        { programId: TOKEN_PROGRAM_ID }
      );

      const tokenMap = new Map();
      for (const { account } of tokenAccounts.value) {
        const parsedData = account.data.parsed.info;
        if (parsedData.tokenAmount.amount === '1' && parsedData.tokenAmount.decimals === 0) {
          tokenMap.set(parsedData.mint, true);
        }
      }

      const compressedNfts = await this.dasApi.getCompressedNftsByOwner(owner);
      const compressedMap = new Map();
      for (const nft of compressedNfts) {
        compressedMap.set(nft.id, nft);
      }

      for (const nftAddress of batch) {
        try {
          if (tokenMap.has(nftAddress)) {
            valid.push({ mint: nftAddress, isCompressed: false });
            continue;
          }

          if (compressedMap.has(nftAddress)) {
            valid.push({ mint: nftAddress, isCompressed: true });
            continue;
          }

          invalid.push(nftAddress);
        } catch (error) {
          console.error(`Erro ao verificar NFT ${nftAddress}:`, error);
          invalid.push(nftAddress);
        }
      }
    }

    return { valid, invalid };
  }

  async createAddressLookupTables(
    nfts: Array<{ mint: PublicKey, isCompressed: boolean }>
  ): Promise<PublicKey[]> {
    const accounts = new Set<string>();

    const standardNfts = nfts.filter(nft => !nft.isCompressed);
    if (standardNfts.length > 0) {
      for (const { mint } of standardNfts) {
        accounts.add(mint.toString());
        accounts.add((await getAssociatedTokenAddress(mint, this.adminKeypair.publicKey)).toString());
        accounts.add((await this.getMetadataAddress(mint)).toString());
      }
    }

    const compressedNfts = nfts.filter(nft => nft.isCompressed);
    if (compressedNfts.length > 0) {
      const trees = new Set<string>();
      for (const { mint } of compressedNfts) {
        const details = await this.dasApi.getCompressedNftDetails(mint.toString());
        trees.add(details.merkleTree);
      }

      for (const tree of trees) {
        accounts.add(tree);
      }
    }

    const altAddresses: PublicKey[] = [];
    const altChunks = chunk(Array.from(accounts).map(acc => new PublicKey(acc)), 30);

    // Implementação real de criação/extensão de ALTs deve ser feita aqui
    // altAddresses.push(novaALT);

    return altAddresses;
  }

  // Utilitário para derivar o endereço de metadados de um mint
  private async getMetadataAddress(mint: PublicKey): Promise<PublicKey> {
    return (
      PublicKey.findProgramAddressSync(
        [
          Buffer.from('metadata'),
          TOKEN_METADATA_PROGRAM_ID.toBuffer(),
          mint.toBuffer(),
        ],
        TOKEN_METADATA_PROGRAM_ID
      )
    )[0];
  }
}
