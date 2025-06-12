# Swig TS SDK Demo

This guide will walk you through setting up and running the Swig SDK transfer example.

## Prerequisites

- Option 1: Node.js v16+ and Yarn v3+ installed
- Option 2: Bun installed
  ```bash
  curl -fsSL https://bun.sh/install | bash
  ```
- Solana CLI tools installed
- Rust and Cargo installed

## Setup Steps

1. Clone the repository

   ```bash
   git clone https://github.com/anagrambuild/swig-ts.git
   cd swig-ts
   ```

2. Install project dependencies

   ```bash
   yarn install  # For Node.js
   # OR
   bun install  # For Bun
   ```
   
3. Navigate to the transfer example and install its dependencies

   ```bash
   cd examples/transfer
   yarn install  # For Node.js
   # No need for bun install here if already done in the root
   ```

4. In a terminal, start the validator. This step may not be required if you are running a `svm` example,
   but it is recommended you do so before you run a `local` example as it depends on localnet, this will install swig locally.

   ```bash
   bun start-validator
   ```

5. In another terminal, run the transfer example e.g
   ```bash
   yarn dlx tsx transfer-local.ts  # For Node.js
   # OR
   bun transfer-local.ts  # For Bun

   ```
