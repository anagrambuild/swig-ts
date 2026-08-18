# Swig SDKs

This repository contains Swig protocol SDKs and tooling. The hosted Developer
SDK for TypeScript and Python now lives in
[`anagrambuild/swig-developer-sdk`](https://github.com/anagrambuild/swig-developer-sdk).

### Run locally

Build the workspace locally by:

1. Installing the packages with:

```bash
bun install
```

2. Build the packages with:
```bash
bun build:packages
```

3. Build the swig program from source with:
```bash
bun update:program
```

4. Run our examples
```bash
cd examples/classic/transfer
```
```bash
bun <filename.ts>
```
