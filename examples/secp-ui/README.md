# Secp UI

This demo shows how to interact with a Swig using an evm based wallet



## Running the example

Start by building workspace dependencies:
```bash
bun build:packages
```

Next, install all dependencies:

```bash
bun install
```


Run the local validator:

```bash
bun start-validator
```

This should initialize a local validator with the pre-funded payer, that will pay transaction fees.

You can now start the application with:

```bash
bun run dev
```



## On the UI

`Generate new wallet`: This generates a new unitialized swig wallet

`Create Swig`: This should initialize a new swig with the generated id

`Request Airdrop`: This airdrops some SOL to the Swig wallet

`Transfer 0.1 SOL`: This should send a 0.1 SOL to a random address