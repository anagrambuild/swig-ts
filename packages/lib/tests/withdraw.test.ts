import { getAddressDecoder } from '@solana/kit';
import { SwigInstructionContext } from '../src';
import { getWithdrawFromSubAccountInstructionContextChecked, Swig } from '../src/swig';

// Dummy data helpers
const dummyAddress = (label: string) =>
  getAddressDecoder().decode(Buffer.from(label.padEnd(32, '1')));

const dummyUint8 = (len = 32) => new Uint8Array(len).fill(1);

const createMockSwig = () => {
  const mockAuthority = {
    id: dummyUint8(32),
    signer: dummyUint8(32),
    type: 0, // Ed25519
    ed25519PublicKey: { toAddress: () => dummyAddress('auth') } as any,
    subAccountWithdrawSol: async () =>
      new SwigInstructionContext({ swigInstruction: {} as any }),
    subAccountWithdrawToken: async () =>
      new SwigInstructionContext({ swigInstruction: {} as any }),
  };

  const mockSwig = {
    address: dummyAddress('swig'),
    findRoleById: () => ({
      id: 1,
      swigId: dummyUint8(32),
      swigAddress: dummyAddress('swig'),
      authority: mockAuthority,
    }),
  } as unknown as Swig;

  return mockSwig;
};

describe('Withdraw Protection', () => {
  const SUB_ACCOUNT_RENT_EXEMPT = 1224960n;

  describe('SOL Withdrawals', () => {
    it('should reject withdrawal that would drop below rent exempt', async () => {
      const mockSwig = createMockSwig();
      const currentBalance = SUB_ACCOUNT_RENT_EXEMPT + 1000000n;
      const withdrawalAmount = 2000000n;

      await expect(
        getWithdrawFromSubAccountInstructionContextChecked(mockSwig, 1, {
          amount: withdrawalAmount,
          allowBelowRentExempt: false,
          currentBalance,
        }),
      ).rejects.toThrow(
        'Withdrawing 2000000 lamports would drop subaccount below rent-exempt minimum',
      );
    });

    it('should allow withdrawal when allowBelowRentExempt is true', async () => {
      const mockSwig = createMockSwig();
      const currentBalance = SUB_ACCOUNT_RENT_EXEMPT + 1000000n;
      const withdrawalAmount = 2000000n;

      const result = await getWithdrawFromSubAccountInstructionContextChecked(
        mockSwig,
        1,
        {
          amount: withdrawalAmount,
          allowBelowRentExempt: true,
          currentBalance,
        },
      );

      expect(result).toBeInstanceOf(SwigInstructionContext);
    });

    it('should allow safe withdrawal', async () => {
      const mockSwig = createMockSwig();
      const currentBalance = SUB_ACCOUNT_RENT_EXEMPT + 2000000n;
      const withdrawalAmount = 1000000n;

      const result = await getWithdrawFromSubAccountInstructionContextChecked(
        mockSwig,
        1,
        {
          amount: withdrawalAmount,
          allowBelowRentExempt: false,
          currentBalance,
        },
      );

      expect(result).toBeInstanceOf(SwigInstructionContext);
    });

    it('should reject withdrawal when currentBalance is not provided and allowBelowRentExempt is true', async () => {
      const mockSwig = createMockSwig();
      const withdrawalAmount = 2000000n;

      await expect(
        getWithdrawFromSubAccountInstructionContextChecked(mockSwig, 1, {
          amount: withdrawalAmount,
          allowBelowRentExempt: true,
        }),
      ).rejects.toThrow(
        'currentBalance is required when allowBelowRentExempt is true',
      );
    });

    it('should allow withdrawal with default allowBelowRentExempt (false) behavior', async () => {
      const mockSwig = createMockSwig();
      const currentBalance = SUB_ACCOUNT_RENT_EXEMPT + 2000000n;
      const withdrawalAmount = 1000000n;

      const result = await getWithdrawFromSubAccountInstructionContextChecked(
        mockSwig,
        1,
        {
          amount: withdrawalAmount,
          currentBalance,
          // allowBelowRentExempt not specified, should default to false
        },
      );

      expect(result).toBeInstanceOf(SwigInstructionContext);
    });

    it('should reject withdrawal with default allowBelowRentExempt (false) when it would drop below rent exempt', async () => {
      const mockSwig = createMockSwig();
      const currentBalance = SUB_ACCOUNT_RENT_EXEMPT + 1000000n;
      const withdrawalAmount = 2000000n;

      await expect(
        getWithdrawFromSubAccountInstructionContextChecked(mockSwig, 1, {
          amount: withdrawalAmount,
          currentBalance,
          // allowBelowRentExempt not specified, should default to false
        }),
      ).rejects.toThrow(
        'Withdrawing 2000000 lamports would drop subaccount below rent-exempt minimum',
      );
    });
  });

  describe('Token Withdrawals', () => {
    it('should allow token withdrawal without rent-exempt validation', async () => {
      const mockSwig = createMockSwig();
      const tokenMint = dummyAddress('mint');
      const withdrawalAmount = 1000000n;

      const result = await getWithdrawFromSubAccountInstructionContextChecked(
        mockSwig,
        1,
        {
          amount: withdrawalAmount,
          mint: tokenMint,
          // No rent-exempt validation should apply for tokens
        },
      );

      expect(result).toBeInstanceOf(SwigInstructionContext);
    });

    it('should allow token withdrawal with allowBelowRentExempt properties (ignored for tokens)', async () => {
      const mockSwig = createMockSwig();
      const tokenMint = dummyAddress('mint');
      const withdrawalAmount = 1000000n;

      const result = await getWithdrawFromSubAccountInstructionContextChecked(
        mockSwig,
        1,
        {
          amount: withdrawalAmount,
          mint: tokenMint,
          allowBelowRentExempt: false,
          currentBalance: 500000n, // Would fail for SOL, but ignored for tokens
        },
      );

      expect(result).toBeInstanceOf(SwigInstructionContext);
    });
  });

});
