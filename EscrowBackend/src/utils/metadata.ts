import { deserializeUnchecked } from 'borsh';

// Classes para desserialização de metadados
class Creator {
  address: Uint8Array;
  verified: number;
  share: number;

  constructor(args: { address: Uint8Array; verified: number; share: number }) {
    this.address = args.address;
    this.verified = args.verified;
    this.share = args.share;
  }
}

class Data {
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  creators: Creator[] | null;

  constructor(args: {
    name: string;
    symbol: string;
    uri: string;
    sellerFeeBasisPoints: number;
    creators: Creator[] | null;
  }) {
    this.name = args.name;
    this.symbol = args.symbol;
    this.uri = args.uri;
    this.sellerFeeBasisPoints = args.sellerFeeBasisPoints;
    this.creators = args.creators;
  }
}

class Metadata {
  key: number;
  updateAuthority: Uint8Array;
  mint: Uint8Array;
  data: Data;
  primarySaleHappened: number;
  isMutable: number;

  constructor(args: {
    key: number;
    updateAuthority: Uint8Array;
    mint: Uint8Array;
    data: Data;
    primarySaleHappened: number;
    isMutable: number;
  }) {
    this.key = args.key;
    this.updateAuthority = args.updateAuthority;
    this.mint = args.mint;
    this.data = args.data;
    this.primarySaleHappened = args.primarySaleHappened;
    this.isMutable = args.isMutable;
  }
}

// Esquema para desserialização Borsh
const METADATA_SCHEMA = new Map<any, any>([
  [Data, {
    kind: 'struct',
    fields: [
      ['name', 'string'],
      ['symbol', 'string'],
      ['uri', 'string'],
      ['sellerFeeBasisPoints', 'u16'],
      ['creators', { kind: 'option', type: [Creator] }],
    ],
  }],
  [Creator, {
    kind: 'struct',
    fields: [
      ['address', [32]],
      ['verified', 'u8'],
      ['share', 'u8'],
    ],
  }],
  [Metadata, {
    kind: 'struct',
    fields: [
      ['key', 'u8'],
      ['updateAuthority', [32]],
      ['mint', [32]],
      ['data', Data],
      ['primarySaleHappened', 'u8'],
      ['isMutable', 'u8'],
    ],
  }],
]);

export function decodeMetadata(buffer: Buffer): Metadata {
  const metadata = deserializeUnchecked(
    METADATA_SCHEMA,
    Metadata,
    buffer
  ) as Metadata;
  return metadata;
}