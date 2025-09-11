import {
  AccountRole,
  address,
  getAddressDecoder,
  getAddressEncoder,
  isSignerRole,
  isWritableRole,
  type IAccountMeta,
  type IInstruction,
  type IInstructionWithAccounts,
  type IInstructionWithData,
  type ReadonlyUint8Array,
} from '@solana/kit';
import { SWIG_PROGRAM_ADDRESS_STRING } from './consts';

/**
 * Utility representing a Solana PublicKey
 */
export class SolPublicKey implements Web3PublicKey {
  #bytes: Uint8Array;

  /**
   * Creates a new {@link SolPublicKey} instance
   *
   * @param data 32-byte publickey bytes or Base58-enoded publickey
   */
  constructor(data: SolPublicKeyData) {
    const bytes =
      typeof data === 'string'
        ? new Uint8Array(getAddressEncoder().encode(address(data)))
        : isWeb3PublicKey(data)
          ? data.toBytes()
          : data;

    if (bytes.length !== 32) {
      throw new Error(
        `Invalid PublicKey byte length. Lenght is ${bytes.length}, not 32 bytes`,
      );
    }

    this.#bytes = bytes;
  }

  toBytes = () => {
    return this.#bytes;
  };

  toAddress = () => {
    return getAddressDecoder().decode(this.#bytes);
  };

  toBase58 = () => {
    return this.toAddress().toString();
  };
}

export function isWeb3Instruction(
  ix: KitInstruction | Web3Instruction,
): ix is Web3Instruction {
  return 'programId' in ix && 'keys' in ix;
}

export function isKitInstruction(
  ix: KitInstruction | Web3Instruction,
): ix is KitInstruction {
  return 'programAddress' in ix && 'accounts' in ix;
}

export type KitInstruction<
  Accounts extends IAccountMeta[] = IAccountMeta[],
  Data extends ReadonlyUint8Array = ReadonlyUint8Array,
  Program extends string = string,
> = IInstruction<Program> &
  IInstructionWithData<Data> &
  IInstructionWithAccounts<Accounts>;

export interface Web3Instruction<
  T extends Web3PublicKey = Web3PublicKey,
  U extends ReadonlyUint8Array = ReadonlyUint8Array,
  V extends Web3PublicKey = Web3PublicKey,
> {
  programId: V;
  keys: Web3AccountMeta<T>[];
  data: U;
}

export function isKitAccountMeta<T extends Web3PublicKey>(
  meta: KitAccountMeta | Web3AccountMeta<T>,
): meta is KitAccountMeta {
  return 'address' in meta && 'role' in meta;
}

export function isWeb3AccountMeta<T extends Web3PublicKey>(
  meta: KitAccountMeta | Web3AccountMeta<T>,
): meta is Web3AccountMeta<T> {
  return 'pubkey' in meta && 'isWritable' in meta && 'isSigner' in meta;
}

export type KitAccountMeta<T extends string = string> = IAccountMeta<T>;

export type Web3AccountMeta<T extends Web3PublicKey = Web3PublicKey> = {
  pubkey: T;
  isWritable: boolean;
  isSigner: boolean;
};

export interface Web3PublicKey {
  toBase58(): string;
  toBytes(): Uint8Array;
}

export function isWeb3PublicKey(obj: any): obj is Web3PublicKey {
  return typeof obj === 'object' && 'toBase58' in obj && 'toBytes' in obj;
}

export class SolAccountMeta {
  publicKey: SolPublicKey;
  writable: boolean;
  signer: boolean;

  constructor(data: {
    publicKey: SolPublicKey;
    writable: boolean;
    signer: boolean;
  }) {
    this.publicKey = data.publicKey;
    this.writable = data.writable;
    this.signer = data.signer;
  }

  static readonly = (publicKey: SolPublicKey): SolAccountMeta => {
    return new SolAccountMeta({ publicKey, signer: false, writable: false });
  };

  static readonlySigner = (publicKey: SolPublicKey): SolAccountMeta => {
    return new SolAccountMeta({ publicKey, signer: true, writable: false });
  };

  static writable = (publicKey: SolPublicKey): SolAccountMeta => {
    return new SolAccountMeta({ publicKey, signer: false, writable: true });
  };

  static writableSigner = (publicKey: SolPublicKey): SolAccountMeta => {
    return new SolAccountMeta({ publicKey, signer: true, writable: true });
  };

  static from<Meta extends Web3AccountMeta | KitAccountMeta>(
    meta: Meta,
  ): SolAccountMeta {
    if (isKitAccountMeta(meta)) {
      return SolAccountMeta.fromKitAccountMeta(meta);
    }
    return SolAccountMeta.fromWeb3AccountMeta(meta);
  }

  static fromWeb3AccountMeta = <T extends Web3PublicKey = Web3PublicKey>(
    meta: Web3AccountMeta<T>,
  ): SolAccountMeta => {
    return new this({
      publicKey: new SolPublicKey(meta.pubkey),
      signer: meta.isSigner,
      writable: meta.isWritable,
    });
  };

  static fromKitAccountMeta = <T extends IAccountMeta = IAccountMeta>(
    meta: T,
  ): SolAccountMeta => {
    return new this({
      publicKey: new SolPublicKey(meta.address),
      signer: isSignerRole(meta.role),
      writable: isWritableRole(meta.role),
    });
  };

  setWritable = (isWritable: boolean) => {
    this.writable = isWritable;
  };

  setSigner = (isSigner: boolean) => {
    this.writable = isSigner;
  };

  toWeb3AccountMeta = (): Web3AccountMeta => {
    return {
      pubkey: this.publicKey,
      isSigner: this.signer,
      isWritable: this.writable,
    };
  };

  toKitAccountMeta = <T extends IAccountMeta = IAccountMeta>(): T => {
    return {
      address: this.publicKey.toAddress(),
      role: this.#getRole(),
    } as T;
  };

  #getRole = (): AccountRole => {
    if (this.writable && this.signer) return AccountRole.WRITABLE_SIGNER;
    if (!this.writable && this.signer) return AccountRole.READONLY_SIGNER;
    if (this.writable && !this.signer) return AccountRole.WRITABLE;
    return AccountRole.READONLY;
  };
}

export class SolInstruction {
  program: SolPublicKey;
  data: Uint8Array;
  accounts: SolAccountMeta[];

  constructor(inst: {
    program: SolPublicKey;
    data: ReadonlyUint8Array;
    accounts: SolAccountMeta[];
  }) {
    this.program = inst.program;
    this.accounts = inst.accounts;
    this.data = new Uint8Array(inst.data);
  }

  static from = <Instruction extends Web3Instruction | KitInstruction>(
    inst: Instruction,
  ) => {
    if (isKitInstruction(inst)) {
      return SolInstruction.fromKitInstruction(inst);
    }

    return SolInstruction.fromWeb3Instruction(inst);
  };

  private static fromWeb3Instruction = (
    inst: Web3Instruction,
  ): SolInstruction => {
    return new this({
      data: inst.data,
      accounts: inst.keys.map((meta) =>
        SolAccountMeta.fromWeb3AccountMeta(meta),
      ),
      program: new SolPublicKey(inst.programId),
    });
  };

  private static fromKitInstruction = (
    inst: KitInstruction,
  ): SolInstruction => {
    return new SolInstruction({
      program: new SolPublicKey(inst.programAddress),
      data: inst.data,
      accounts: inst.accounts.map((acct) =>
        SolAccountMeta.fromKitAccountMeta(acct),
      ),
    });
  };

  toWeb3Instruction = (): Web3Instruction<Web3PublicKey, Uint8Array> => {
    return {
      data: new Uint8Array(this.data),
      keys: this.accounts.map((meta) => meta.toWeb3AccountMeta()),
      programId: this.program,
    };
  };

  toKitInstruction = (): KitInstruction<IAccountMeta[], Uint8Array> => {
    return {
      accounts: this.accounts.map((acct) => acct.toKitAccountMeta()),
      data: new Uint8Array(this.data),
      programAddress: this.program.toAddress(),
    };
  };
}

export function swigInstruction(
  accounts: SolAccountMeta[],
  data: ReadonlyUint8Array,
) {
  return new SolInstruction({
    data,
    accounts,
    program: new SolPublicKey(SWIG_PROGRAM_ADDRESS_STRING),
  });
}

export type SolPublicKeyData = Uint8Array | string | Web3PublicKey;

export class SwigInstructionContext {
  preInstructions: SolInstruction[];
  postInstructions: SolInstruction[];
  swigInstruction: SolInstruction;

  constructor(instructions: {
    swigInstruction: SolInstruction;
    preInstructions?: SolInstruction[];
    postInstructions?: SolInstruction[];
  }) {
    this.swigInstruction = instructions.swigInstruction ?? [];
    this.preInstructions = instructions.preInstructions ?? [];
    this.postInstructions = instructions.postInstructions ?? [];
  }

  getKitInstructions = () => {
    return [
      ...this.preInstructions.map((ix) => ix.toKitInstruction()),
      this.swigInstruction.toKitInstruction(),
      ...this.postInstructions.map((ix) => ix.toKitInstruction()),
    ];
  };

  getWeb3Instructions = () => {
    return [
      ...this.preInstructions.map((ix) => ix.toWeb3Instruction()),
      this.swigInstruction.toWeb3Instruction(),
      ...this.postInstructions.map((ix) => ix.toWeb3Instruction()),
    ];
  };
}
