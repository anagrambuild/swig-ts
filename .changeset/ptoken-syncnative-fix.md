---
'@swig-wallet/lib': major
---

**Breaking Change:** Fix p-token #138 SyncNative account validation

The `compactInstructions` function previously appended the swig account to `SyncNative` instructions when they followed a `SystemProgram.transfer` (as part of the unbalanced-CPI lamport tracking workaround for solana-labs/solana#9711). After p-token #138, `SyncNative` validates extra accounts: if a second account exists it must be the Rent sysvar — otherwise the instruction errors. The bare swig account appended by `handleUnbalanced` caused transactions to fail.

This update:

- Sanitizes `SyncNative` instructions before compaction, stripping any extraneous accounts so the base instruction references exactly one account (the wSOL ATA)
- When `handleUnbalanced` fires after a `SystemProgram.transfer` and the next instruction is `SyncNative`, inserts the Rent sysvar before the swig account so the final compact instruction sees `[wSOL ATA, Rent, swigAccount]`
- For non-`SyncNative` instructions, `handleUnbalanced` continues to append only the swig account as before

Pre-p-token silently ignores extra accounts, so adding Rent + swigAccount is backwards-safe. Post-p-token, the Rent sysvar satisfies the strict validation.

This is a required upgrade for all swig-ts clients that wrap SOL. Transactions containing `SyncNative` with an invalid extra account will be rejected once p-token account validation is live.

See [swig-wallet#154](https://github.com/anagrambuild/swig-wallet/pull/154) for the coordinated breaking-change documentation.
