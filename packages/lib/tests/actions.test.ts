import { type Address } from '@solana/kit';
import { Actions } from '../src/actions/action';

const dummyAddress = (): Address =>
  '11111111111111111111111111111111' as Address;
const dummyAddress2 = (): Address =>
  '4Nd1mYwq3pR9bN9bA5uQK2gqVjQhQhQhQhQhQhQhQhQh' as Address;

describe('Actions', () => {
  it('tracks spend limits separately for different mints', () => {
    const mint1 = dummyAddress();
    const mint2 = dummyAddress2();
    const actions = Actions.set()
      .tokenLimit({ mint: mint1, amount: 100n })
      .tokenLimit({ mint: mint2, amount: 200n })
      .get();

    expect(actions.tokenSpendLimit(mint1)).toBe(100n);
    expect(actions.tokenSpendLimit(mint2)).toBe(200n);
  });

  it('returns none SpendController when no SOL spend action exists', () => {
    const actions = Actions.set()
      .programLimit({ programId: dummyAddress() })
      .get();
    const controller = actions.solSpend();
    expect(controller.isAllowed).toBe(false);
    expect(controller.spendLimit).toBe(0n);
  });

  it('returns none SpendController when no token spend action exists', () => {
    const mint = dummyAddress();
    const actions = Actions.set()
      .programLimit({ programId: dummyAddress() })
      .get();
    const controller = actions.tokenSpend(mint);
    expect(controller.isAllowed).toBe(false);
    expect(controller.spendLimit).toBe(0n);
  });

  it('returns max SOL spend when using root permission', () => {
    const actions = Actions.set().all().get();
    const controller = actions.solSpend();
    expect(controller.isAllowed).toBe(true);
    expect(controller.spendLimit).toBe(null); // uncapped
    expect(controller.canSpend(100000000000000n)).toBe(true);
  });

  it('returns max token spend when using root permission', () => {
    const mint = dummyAddress();
    const actions = Actions.set().all().get();
    const controller = actions.tokenSpend(mint);
    expect(controller.isAllowed).toBe(true);
    expect(controller.spendLimit).toBe(null); // uncapped
    expect(controller.canSpend(10_000n)).toBe(true);
  });

  it('returns the maximum spend limit when multiple SOL spend limits exist', () => {
    const actions = Actions.set()
      .solLimit({ amount: 200n })
      .solLimit({ amount: 500n })
      .solLimit({ amount: 100n })
      .get();

    expect(actions.solSpendLimit()).toBe(500n);
  });

  it('returns null for SOL spend limit if any is uncapped', () => {
    const actions = Actions.set()
      .solLimit({ amount: 300n })
      .all() // uncapped
      .get();

    expect(actions.solSpendLimit()).toBe(null);
  });

  it('returns null for token spend limit if any is uncapped', () => {
    const mint = dummyAddress();
    const actions = Actions.set()
      .tokenLimit({ mint, amount: 300n })
      .all() // uncapped
      .get();

    expect(actions.tokenSpendLimit(mint)).toBe(null);
  });

  it('returns max token spend limit among multiple token limits', () => {
    const mint = dummyAddress();
    const actions = Actions.set()
      .tokenLimit({ mint, amount: 250n })
      .tokenLimit({ mint, amount: 700n })
      .get();

    expect(actions.tokenSpendLimit(mint)).toBe(700n);
  });

  it('should create a role with solDestinationLimit and programAll permissions', () => {
    const destination = dummyAddress();
    const amount = 500_000_000n; // 0.5 SOL in lamports

    // Test the exact pattern from successful Rust tests: programAll + solDestinationLimit
    const actions = Actions.set()
      .programAll()
      .solDestinationLimit({
        destination,
        amount,
      })
      .get();

    // Verify the actions builder works (no errors thrown)
    expect(actions.count).toBe(2);

    // Verify programAll permission allows program usage
    expect(actions.hasProgramAction()).toBe(true);
    expect(actions.canUseProgram('11111111111111111111111111111111')).toBe(
      true,
    );

    // Verify SOL spend capabilities (destination limits should provide spend capability)
    expect(actions.canSpendSol()).toBe(true);
  });

  it('should create a role with solDestinationLimit and specific program permissions', () => {
    const destination = dummyAddress();
    const amount = 1_000_000_000n; // 1 SOL in lamports
    const systemProgramId = '11111111111111111111111111111111' as Address;

    // Test the pattern from CPI enforcement Rust test: solDestinationLimit + program
    const actions = Actions.set()
      .solDestinationLimit({
        destination,
        amount,
      })
      .programLimit({
        programId: systemProgramId,
      })
      .get();

    // Verify the actions were created
    expect(actions.count).toBe(2);

    // Verify program permission allows specific program usage
    expect(actions.hasProgramAction()).toBe(true);
    expect(actions.canUseProgram(systemProgramId)).toBe(true);

    // Verify SOL spend capabilities
    expect(actions.canSpendSol()).toBe(true);
  });

  it('should create a role with mixed SOL limits (general + destination)', () => {
    const destination = dummyAddress();
    const generalLimit = 800_000_000n; // 0.8 SOL
    const destinationLimit = 500_000_000n; // 0.5 SOL

    // Test the mixed limits pattern from Rust tests: solLimit + solDestinationLimit
    const actions = Actions.set()
      .solLimit({ amount: generalLimit })
      .solDestinationLimit({
        destination,
        amount: destinationLimit,
      })
      .get();

    // Verify the actions were created
    expect(actions.count).toBe(2);

    // Verify SOL spend capabilities with mixed limits
    expect(actions.canSpendSol()).toBe(true);

    // The general limit should be the controlling limit since both are present
    // The implementation should return the maximum limit when multiple limits exist
    expect(actions.solSpendLimit()).toBe(generalLimit);
  });

  it('should handle ordering independence of permissions', () => {
    const destination = dummyAddress();
    const amount = 500_000_000n;

    // Test different orderings work (based on Rust test findings)
    const actions1 = Actions.set()
      .programAll()
      .solDestinationLimit({ destination, amount })
      .get();

    const actions2 = Actions.set()
      .solDestinationLimit({ destination, amount })
      .programAll()
      .get();

    // Both should have same capabilities regardless of order
    expect(actions1.count).toBe(2);
    expect(actions2.count).toBe(2);
    expect(actions1.hasProgramAction()).toBe(true);
    expect(actions2.hasProgramAction()).toBe(true);
    expect(actions1.canSpendSol()).toBe(true);
    expect(actions2.canSpendSol()).toBe(true);
  });
});
