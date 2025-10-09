import {
  ACTION_HEADER_LENGTH,
  getActionHeaderEncoder,
  getBlacklistCodec,
  getProgramCuratedEncoder,
  getProgramLimitEncoder,
  getProgramScopeEncoder,
  getSolDestinationLimitEncoder,
  getSolLimitEncoder,
  getSolRecurringDestinationLimitEncoder,
  getSolRecurringLimitEncoder,
  getStakeLimitEncoder,
  getStakeRecurringLimitEncoder,
  getSubAccountEncoder,
  getTokenDestinationLimitEncoder,
  getTokenLimitEncoder,
  getTokenRecurringDestinationLimitEncoder,
  getTokenRecurringLimitEncoder,
  NumericType,
  Permission,
  ProgramScopeType,
  toBlacklistEntityKind,
  type ActionHeader,
  type BlacklistData,
  type BlacklistEntity,
  type ProgramLimit,
  type ProgramScope,
  type SolDestinationLimit,
  type SolLimit,
  type SolRecurringDestinationLimit,
  type SolRecurringLimit,
  type StakeLimit,
  type StakeRecurringLimit,
  type SubAccount,
  type TokenDestinationLimit,
  type TokenLimit,
  type TokenRecurringDestinationLimit,
  type TokenRecurringLimit,
} from '@swig-wallet/coder';
import { SolPublicKey, type SolPublicKeyData } from '../solana';
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
    const bytes = new Uint8Array(this.bufferLength());

    this._actionConfigs.forEach((config) => {
      const boundary = cursor + config.lengthWithHeader;
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
    const { bytes, noOfActions } = this.data();
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
   * Enable AllButMangeAuthority action
   */
  allButManageAuthority(): this {
    this._actionConfigs.push(new AllButManageAuthorityConfig());
    return this;
  }

  /**
   * Blackist a Solana account
   * @param payload.entityId ID of the program/wallet to blacklist
   * @param payload.entity entity type: Program/Wallet
   */
  blacklist(payload: {
    entityId: SolPublicKeyData;
    entityType: BlacklistEntity;
  }): this {
    this._actionConfigs.push(
      new BlacklistConfig({
        entityId: new SolPublicKey(payload.entityId).toBytes(),
        entityKind: toBlacklistEntityKind(payload.entityType),
      }),
    );
    return this;
  }

  /**
   * Enable a program scope
   * @param payload.programId ID of the program to enable
   */
  programLimit(payload: { programId: SolPublicKeyData }): this {
    this._actionConfigs.push(
      new ProgramLimitConfig({
        programId: new SolPublicKey(payload.programId).toBytes(),
      }),
    );
    return this;
  }

  /**
   * Enable all programs
   */
  programAll(): this {
    this._actionConfigs.push(new ProgramAllConfig());
    return this;
  }

  /**
   * Enable curated programs
   */
  programCurated(): this {
    this._actionConfigs.push(new ProgramCuratedConfig());
    return this;
  }

  /**
   * Basic program scope
   * @param payload.programId Program ID
   * @param payload.targetAccount Program Account to target
   * @returns Basic ProgramScope action
   */
  programScopeBasic(payload: {
    programId: SolPublicKeyData;
    targetAccount: SolPublicKeyData;
  }) {
    this._actionConfigs.push(
      new ProgramScopeConfig({
        currentAmount: 0n,
        lastReset: 0n,
        window: 0n,
        numericType: NumericType.U8,
        limit: 0n,
        programId: new SolPublicKey(payload.programId).toBytes(),
        scopeType: ProgramScopeType.Basic,
        targetAccount: new SolPublicKey(payload.targetAccount).toBytes(),
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
    programId: SolPublicKeyData;
    targetAccount: SolPublicKeyData;
  }) {
    this._actionConfigs.push(
      new ProgramScopeConfig({
        currentAmount: payload.amount,
        lastReset: 0n,
        window: 0n,
        numericType: payload.numericType,
        limit: payload.amount,
        programId: new SolPublicKey(payload.programId).toBytes(),
        scopeType: ProgramScopeType.Basic,
        targetAccount: new SolPublicKey(payload.targetAccount).toBytes(),
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
    programId: SolPublicKeyData;
    targetAccount: SolPublicKeyData;
  }) {
    this._actionConfigs.push(
      new ProgramScopeConfig({
        currentAmount: payload.amount,
        lastReset: 0n,
        window: payload.window,
        numericType: payload.numericType,
        limit: payload.amount,
        programId: new SolPublicKey(payload.programId).toBytes(),
        scopeType: ProgramScopeType.Basic,
        targetAccount: new SolPublicKey(payload.targetAccount).toBytes(),
        balance_field_end: 0n,
        balance_field_start: 0n,
      }),
    );
    return this;
  }

  /**
   * controls a subaccount
   */
  subAccount(): this {
    this._actionConfigs.push(
      new SubAccountConfig({
        subAccount: new Uint8Array(32),
        _padding: new Uint8Array(2),
        bump: 0,
        enabled: false,
        roleId: 0,
        swigId: new Uint8Array(32),
      }),
    );
    return this;
  }

  /**
   * Enables a StakeAll action
   */
  stakeAll(): this {
    this._actionConfigs.push(new StakeAllConfig());
    return this;
  }

  /**
   * Enables a Spend-once SOL Spend
   * @param payload.amount ID of the program to enable
   */
  stakeLimit(payload: { amount: bigint }): this {
    this._actionConfigs.push(new StakeLimitConfig(payload));
    return this;
  }

  /**
   * Enables a Spend-recurring SOL Spend
   * @param payload.recurringAmount recurring amount per window
   * @param payload.window period in slots until amount reset.
   */
  stakeRecurringLimit(payload: {
    recurringAmount: bigint;
    window: bigint;
  }): this {
    this._actionConfigs.push(
      new StakeRecurringLimitConfig({
        ...payload,
        currentAmount: payload.recurringAmount,
        lastReset: 0n,
      }),
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
      new SolRecurringLimitConfig({
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
  tokenLimit(payload: { mint: SolPublicKeyData; amount: bigint }): this {
    this._actionConfigs.push(
      new TokenLimitConfig({
        ...payload,
        mint: new SolPublicKey(payload.mint).toBytes(),
      }),
    );
    return this;
  }

  /**
   * Enables a Spend-recurring Token Spend
   * @param payload.mint token mint public key
   * @param payload.recurringAmount recurring amount per window
   * @param payload.window period in slots until amount reset
   */
  tokenRecurringLimit(payload: {
    mint: SolPublicKeyData;
    recurringAmount: bigint;
    window: bigint;
  }): this {
    this._actionConfigs.push(
      new TokenRecurringLimitConfig({
        ...payload,
        mint: new SolPublicKey(payload.mint).toBytes(),
        currentAmount: payload.recurringAmount,
        lastReset: 0n,
      }),
    );
    return this;
  }

  /**
   * Enables a Spend-once SOL Spend to a specific destination
   * @param payload.amount amount allowed to spend
   * @param payload.destination destination public key
   */
  solDestinationLimit(payload: {
    amount: bigint;
    destination: SolPublicKeyData;
  }): this {
    this._actionConfigs.push(
      new SolDestinationLimitConfig({
        ...payload,
        destination: new SolPublicKey(payload.destination).toBytes(),
      }),
    );
    return this;
  }

  /**
   * Enables a Spend-recurring SOL Spend to a specific destination
   * @param payload.recurringAmount recurring amount per window
   * @param payload.window period in slots until amount reset
   * @param payload.destination destination public key
   */
  solRecurringDestinationLimit(payload: {
    recurringAmount: bigint;
    window: bigint;
    destination: SolPublicKeyData;
  }): this {
    this._actionConfigs.push(
      new SolRecurringDestinationLimitConfig({
        ...payload,
        destination: new SolPublicKey(payload.destination).toBytes(),
        currentAmount: payload.recurringAmount,
        lastReset: 0n,
      }),
    );
    return this;
  }

  /**
   * Enables a Spend-once Token Spend to a specific destination
   * @param payload.mint token mint public key
   * @param payload.amount amount allowed to spend
   * @param payload.destination destination public key
   */
  tokenDestinationLimit(payload: {
    mint: SolPublicKeyData;
    amount: bigint;
    destination: SolPublicKeyData;
  }): this {
    this._actionConfigs.push(
      new TokenDestinationLimitConfig({
        ...payload,
        mint: new SolPublicKey(payload.mint).toBytes(),
        destination: new SolPublicKey(payload.destination).toBytes(),
      }),
    );
    return this;
  }

  /**
   * Enables a Spend-recurring Token Spend to a specific destination
   * @param payload.mint token mint public key
   * @param payload.recurringAmount recurring amount per window
   * @param payload.window period in slots until amount reset
   * @param payload.destination destination public key
   */
  tokenRecurringDestinationLimit(payload: {
    mint: SolPublicKeyData;
    recurringAmount: bigint;
    window: bigint;
    destination: SolPublicKeyData;
  }): this {
    this._actionConfigs.push(
      new TokenRecurringDestinationLimitConfig({
        ...payload,
        mint: new SolPublicKey(payload.mint).toBytes(),
        destination: new SolPublicKey(payload.destination).toBytes(),
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
    const data = this.encode();
    const header = getActionHeaderEncoder().encode(this.header(boundary));

    const bytes = new Uint8Array(this.lengthWithHeader);

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

class AllButManageAuthorityConfig extends ActionConfig {
  constructor() {
    super();
  }

  get length() {
    return 0;
  }

  get permission() {
    return Permission.AllButManageAuthority;
  }

  encode(): Uint8Array {
    return new Uint8Array(0);
  }
}

class BlacklistConfig extends ActionConfig {
  constructor(private payload: BlacklistData) {
    super();
  }

  get length() {
    return 40;
  }

  get permission() {
    return Permission.Blacklist;
  }

  encode(): Uint8Array {
    return Uint8Array.from(getBlacklistCodec().encode(this.payload));
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
    return 72;
  }

  get permission() {
    return Permission.SubAccount;
  }

  encode(): Uint8Array {
    return Uint8Array.from(getSubAccountEncoder().encode(this.payload));
  }
}

class StakeAllConfig extends ActionConfig {
  constructor() {
    super();
  }

  get length() {
    return 0;
  }

  get permission() {
    return Permission.StakeAll;
  }

  encode(): Uint8Array {
    return new Uint8Array(0);
  }
}

class StakeLimitConfig extends ActionConfig {
  constructor(private payload: StakeLimit) {
    super();
  }

  get length() {
    return 8;
  }

  get permission() {
    return Permission.StakeLimit;
  }

  encode(): Uint8Array {
    return Uint8Array.from(getStakeLimitEncoder().encode(this.payload));
  }
}

class StakeRecurringLimitConfig extends ActionConfig {
  constructor(private payload: StakeRecurringLimit) {
    super();
  }

  get length() {
    return 32;
  }

  get permission() {
    return Permission.StakeRecurringLimit;
  }

  encode(): Uint8Array {
    return Uint8Array.from(
      getStakeRecurringLimitEncoder().encode(this.payload),
    );
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

class SolRecurringLimitConfig extends ActionConfig {
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

class TokenRecurringLimitConfig extends ActionConfig {
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

class ProgramAllConfig extends ActionConfig {
  constructor() {
    super();
  }

  get length() {
    return 0;
  }

  get permission() {
    return Permission.ProgramAll;
  }

  encode(): Uint8Array {
    return new Uint8Array(0);
  }
}

class ProgramCuratedConfig extends ActionConfig {
  constructor() {
    super();
  }

  get length() {
    return 0;
  }

  get permission() {
    return Permission.ProgramCurated;
  }

  encode(): Uint8Array {
    return Uint8Array.from(getProgramCuratedEncoder().encode({}));
  }
}

class SolDestinationLimitConfig extends ActionConfig {
  constructor(private payload: SolDestinationLimit) {
    super();
  }

  get length() {
    return 40;
  }

  get permission() {
    return Permission.SolDestinationLimit;
  }

  encode(): Uint8Array {
    return Uint8Array.from(
      getSolDestinationLimitEncoder().encode(this.payload),
    );
  }
}

class SolRecurringDestinationLimitConfig extends ActionConfig {
  constructor(private payload: SolRecurringDestinationLimit) {
    super();
  }

  get length() {
    return 64;
  }

  get permission() {
    return Permission.SolRecurringDestinationLimit;
  }

  encode(): Uint8Array {
    return Uint8Array.from(
      getSolRecurringDestinationLimitEncoder().encode(this.payload),
    );
  }
}

class TokenDestinationLimitConfig extends ActionConfig {
  constructor(private payload: TokenDestinationLimit) {
    super();
  }

  get length() {
    return 72;
  }

  get permission() {
    return Permission.TokenDestinationLimit;
  }

  encode(): Uint8Array {
    return Uint8Array.from(
      getTokenDestinationLimitEncoder().encode(this.payload),
    );
  }
}

class TokenRecurringDestinationLimitConfig extends ActionConfig {
  constructor(private payload: TokenRecurringDestinationLimit) {
    super();
  }

  get length() {
    return 96;
  }

  get permission() {
    return Permission.TokenRecurringDestinationLimit;
  }

  encode(): Uint8Array {
    return Uint8Array.from(
      getTokenRecurringDestinationLimitEncoder().encode(this.payload),
    );
  }
}
