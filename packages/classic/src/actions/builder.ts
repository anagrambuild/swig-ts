import type { PublicKey } from '@solana/web3.js';
import {
  ACTION_HEADER_LENGTH,
  getActionHeaderEncoder,
  getProgramLimitEncoder,
  getProgramScopeEncoder,
  getSolLimitEncoder,
  getSolRecurringLimitEncoder,
  getSubAccountEncoder,
  getTokenLimitEncoder,
  getTokenRecurringLimitEncoder,
  NumericType,
  Permission,
  ProgramScopeType,
  type ActionHeader,
  type ProgramLimit,
  type ProgramScope,
  type SolLimit,
  type SolRecurringLimit,
  type SubAccount,
  type TokenLimit,
  type TokenRecurringLimit,
} from '@swig/coder';
import { Actions } from './action';

type ActionsData = { bytes: Uint8Array; noOfActions: number };

/**
 * Utility class for composing actions
 */
export class ActionsBuilder {
  private _actionConfigs: ActionConfig[] = [];

  private constructor() {}

  static new() {
    return new ActionsBuilder();
  }

  private get count() {
    return this._actionConfigs.length;
  }

  private data(): ActionsData {
    let cursor = 0;
    let bytes = new Uint8Array(this.bufferLength());

    this._actionConfigs.forEach((config) => {
      let boundary = cursor + config.lengthWithHeader;
      bytes.set(config.encodeWithHeader(boundary), cursor);
      cursor = boundary;
    });

    return { bytes, noOfActions: this.count };
  }

  /**
   * Gets the composed actions
   * @returns Actions
   */
  get() {
    let { bytes, noOfActions } = this.data();
    return Actions.from(bytes, noOfActions);
  }

  private bufferLength() {
    return this._actionConfigs.reduce(
      (sum, curr) => sum + curr.lengthWithHeader,
      0,
    );
  }

  /**
   * Enable root action
   */
  all(): this {
    this._actionConfigs.push(new AllConfig());
    return this;
  }

  /**
   * Enable Manager action
   */
  manageAuthority(): this {
    this._actionConfigs.push(new ManageAuthorityConfig());
    return this;
  }

  /**
   * Enable a program scope
   * @param payload.programId ID of the program to enable
   */
  programLimit(payload: { programId: PublicKey }): this {
    this._actionConfigs.push(
      new ProgramLimitConfig({ programId: payload.programId.toBytes() }),
    );
    return this;
  }

  /**
   * Basic program scope
   * @param payload.programId Program ID
   * @param payload.targetAccount Program Account to target
   * @returns Basic ProgramScope action
   */
  programScopeBasic(payload: {
    programId: PublicKey;
    targetAccount: PublicKey;
  }) {
    this._actionConfigs.push(
      new ProgramScopeConfig({
        currentAmount: 0n,
        lastReset: 0n,
        window: 0n,
        numericType: NumericType.U8,
        limit: 0n,
        programId: payload.programId.toBytes(),
        scopeType: ProgramScopeType.Basic,
        targetAccount: payload.targetAccount.toBytes(),
        balance_field_end: 0n,
        balance_field_start: 0n,
      }),
    );
    return this;
  }

  /**
   * Limit ProgramScope
   * @param payload.amount Max amount spendable
   * @param payload.numericType Numeric type of the amount. i.e u8, u32, u64 or u128
   * @param payload.programId Program ID
   * @param payload.targetAccount Program Account to target
   * @return Limit ProgramScope
   */
  programScopeLimit(payload: {
    amount: bigint;
    numericType: NumericType;
    programId: PublicKey;
    targetAccount: PublicKey;
  }) {
    this._actionConfigs.push(
      new ProgramScopeConfig({
        currentAmount: payload.amount,
        lastReset: 0n,
        window: 0n,
        numericType: payload.numericType,
        limit: payload.amount,
        programId: payload.programId.toBytes(),
        scopeType: ProgramScopeType.Basic,
        targetAccount: payload.targetAccount.toBytes(),
        balance_field_end: 0n,
        balance_field_start: 0n,
      }),
    );
    return this;
  }

  /**
   * RecurringLimit ProgramScope
   * @param payload.amount Max amount spendable
   * @param payload.window Duration in slot between limits reset
   * @param payload.numericType Numeric type of the amount. i.e u8, u32, u64 or u128
   * @param payload.programId Program ID
   * @param payload.targetAccount Program Account to target
   * @return RecurringLimit ProgramScope
   */
  programScopeRecurringLimit(payload: {
    amount: bigint;
    window: bigint;
    numericType: NumericType;
    programId: PublicKey;
    targetAccount: PublicKey;
  }) {
    this._actionConfigs.push(
      new ProgramScopeConfig({
        currentAmount: payload.amount,
        lastReset: 0n,
        window: payload.window,
        numericType: payload.numericType,
        limit: payload.amount,
        programId: payload.programId.toBytes(),
        scopeType: ProgramScopeType.Basic,
        targetAccount: payload.targetAccount.toBytes(),
        balance_field_end: 0n,
        balance_field_start: 0n,
      }),
    );
    return this;
  }

  /**
   * controls a subaccount
   * @param payload.subAccount Sub-account publickey
   */
  subAccount(payload: { subAccount: PublicKey }): this {
    this._actionConfigs.push(
      new SubAccountConfig({ subAccount: payload.subAccount.toBytes() }),
    );
    return this;
  }

  /**
   * Enables a Spend-once SOL Spend
   * @param payload.amount ID of the program to enable
   */
  solLimit(payload: { amount: bigint }): this {
    this._actionConfigs.push(new SolLimitConfig(payload));
    return this;
  }

  /**
   * Enables a Spend-recurring SOL Spend
   * @param payload.recurringAmount recurring amount per window
   * @param payload.window period in slots until amount reset.
   */
  solRecurringLimit(payload: {
    recurringAmount: bigint;
    window: bigint;
  }): this {
    this._actionConfigs.push(
      new SolReccuringLimitConfig({
        ...payload,
        currentAmount: payload.recurringAmount,
        lastReset: 0n,
      }),
    );
    return this;
  }

  /**
   * Enables a Spend-once Token Spend
   * @param payload.mint token mint public key
   * @param payload.amount amount allowed to spend
   */
  tokenLimit(payload: { mint: PublicKey; amount: bigint }): this {
    this._actionConfigs.push(
      new TokenLimitConfig({ ...payload, mint: payload.mint.toBytes() }),
    );
    return this;
  }

  /**
   * Enables a Spend-recurring Token Spend
   * @param payload.mint token mint public key
   * @param payload.recurringAmount recurring amount per window
   * @param payload.window period in slots until amount reset
   */
  tokenReccuringLimit(payload: {
    mint: PublicKey;
    recurringAmount: bigint;
    window: bigint;
  }): this {
    this._actionConfigs.push(
      new TokenReccuringLimitConfig({
        ...payload,
        mint: payload.mint.toBytes(),
        currentAmount: payload.recurringAmount,
        lastReset: 0n,
      }),
    );
    return this;
  }
}

/**
 * Abstract utility for composing an action
 */
abstract class ActionConfig {
  abstract length: number;
  abstract permission: Permission;

  abstract encode(): Uint8Array;

  get lengthWithHeader() {
    return ACTION_HEADER_LENGTH + this.length;
  }

  header(boundary: number): ActionHeader {
    return { permission: this.permission, length: this.length, boundary };
  }

  encodeWithHeader(boundary: number): Readonly<Uint8Array> {
    let data = this.encode();
    let header = getActionHeaderEncoder().encode(this.header(boundary));

    let bytes = new Uint8Array(this.lengthWithHeader);

    bytes.set(header);

    if (this.lengthWithHeader > ACTION_HEADER_LENGTH) {
      bytes.set(data, ACTION_HEADER_LENGTH);
    }

    return bytes;
  }
}

class AllConfig extends ActionConfig {
  constructor() {
    super();
  }

  get length() {
    return 0;
  }

  get permission() {
    return Permission.All;
  }

  encode(): Uint8Array {
    return new Uint8Array(0);
  }
}

class ManageAuthorityConfig extends ActionConfig {
  constructor() {
    super();
  }

  get length() {
    return 0;
  }

  get permission() {
    return Permission.ManageAuthority;
  }

  encode(): Uint8Array {
    return new Uint8Array(0);
  }
}

class ProgramLimitConfig extends ActionConfig {
  constructor(private payload: ProgramLimit) {
    super();
  }

  get length() {
    return 32;
  }

  get permission() {
    return Permission.Program;
  }

  encode(): Uint8Array {
    return Uint8Array.from(getProgramLimitEncoder().encode(this.payload));
  }
}

class SubAccountConfig extends ActionConfig {
  constructor(private payload: SubAccount) {
    super();
  }

  get length() {
    return 32;
  }

  get permission() {
    return Permission.SubAccount;
  }

  encode(): Uint8Array {
    return Uint8Array.from(getSubAccountEncoder().encode(this.payload));
  }
}

class SolLimitConfig extends ActionConfig {
  constructor(private payload: SolLimit) {
    super();
  }

  get length() {
    return 8;
  }

  get permission() {
    return Permission.SolLimit;
  }

  encode(): Uint8Array {
    return Uint8Array.from(getSolLimitEncoder().encode(this.payload));
  }
}

class SolReccuringLimitConfig extends ActionConfig {
  constructor(private payload: SolRecurringLimit) {
    super();
  }

  get length() {
    return 32;
  }

  get permission() {
    return Permission.SolRecurringLimit;
  }

  encode(): Uint8Array {
    return Uint8Array.from(getSolRecurringLimitEncoder().encode(this.payload));
  }
}

class TokenLimitConfig extends ActionConfig {
  constructor(private payload: TokenLimit) {
    super();
  }

  get length() {
    return 40;
  }

  get permission() {
    return Permission.TokenLimit;
  }

  encode(): Uint8Array {
    return Uint8Array.from(getTokenLimitEncoder().encode(this.payload));
  }
}

class TokenReccuringLimitConfig extends ActionConfig {
  constructor(private payload: TokenRecurringLimit) {
    super();
  }

  get length() {
    return 64;
  }

  get permission() {
    return Permission.TokenRecurringLimit;
  }

  encode(): Uint8Array {
    return Uint8Array.from(
      getTokenRecurringLimitEncoder().encode(this.payload),
    );
  }
}

class ProgramScopeConfig extends ActionConfig {
  constructor(private payload: ProgramScope) {
    super();
  }

  get length() {
    return 144;
  }

  get permission() {
    return Permission.ProgramScope;
  }

  encode(): Uint8Array {
    return Uint8Array.from(getProgramScopeEncoder().encode(this.payload));
  }
}
