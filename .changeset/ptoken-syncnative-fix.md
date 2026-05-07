---
'@swig-wallet/lib': major
---

**Breaking Change:** Fix p-token #138 SyncNative account validation

The `compactInstructions` function previously appended an extra account to `SyncNative` instructions when they followed a `SystemProgram.transfer`, causing transactions to fail after p-token's stricter account validation. This update:

- Sanitizes `SyncNative` instructions before compaction, ensuring they reference exactly one account (the wSOL ATA)
- Skips the `handleUnbalanced` extra-account logic for `SyncNative` instructions

This is a required upgrade for all swig-ts clients that wrap SOL. Transactions containing `SyncNative` with an invalid extra account will be rejected once p-token account validation is live.

See [swig-wallet#154](https://github.com/anagrambuild/swig-wallet/pull/154) for the coordinated breaking-change documentation.
