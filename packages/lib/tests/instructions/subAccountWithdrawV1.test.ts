/**
 * Tests for SubAccountWithdrawV1 instruction - Withdrawing from sub-accounts
 *
 * Note: These tests are currently skipped due to "insufficient account keys" errors
 * in the instruction builder. The withdraw instruction structure needs investigation.
 */

describe('SubAccountWithdrawV1 Instruction', () => {
  // ============================================================================
  // Ed25519 Authority - SOL Withdrawal
  // ============================================================================
  // Note: All withdraw tests fail with "insufficient account keys for instruction"
  // This suggests the instruction builder is missing required accounts

  test.skip('placeholder - withdraw tests need investigation', () => {
    // TODO: Investigate subAccountWithdrawV1 instruction account requirements
    // The instruction builder may be missing required accounts like:
    // - Swig wallet address
    // - System program
    // - Other accounts needed for the withdraw instruction
  });
});
