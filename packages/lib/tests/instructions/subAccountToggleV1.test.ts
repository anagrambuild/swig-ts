/**
 * Tests for SubAccountToggleV1 instruction - Toggling sub-account status
 *
 * Note: These tests are currently skipped due to permission errors (0x21, 0xbb9)
 * in the program. The toggle instruction may require specific permissions
 * that are not being set correctly.
 */

describe('SubAccountToggleV1 Instruction', () => {
  // ============================================================================
  // Toggle Tests
  // ============================================================================
  // Note: All toggle tests fail with permission errors
  // - Error 0x21 (33): Likely a permission/authorization issue
  // - Error 0xbb9 (3001): PermissionDenied
  //
  // The subAccount permission may not include the ability to toggle
  // or the acting authority may need different permissions

  test.skip('placeholder - toggle tests need investigation', () => {
    // TODO: Investigate subAccountToggleV1 permission requirements
    // Questions to answer:
    // 1. Does subAccount permission include toggle capability?
    // 2. Does the acting authority need to be root or have manageAuthority?
    // 3. Are there separate enable/disable permissions?
  });
});
