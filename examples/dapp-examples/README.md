# Swig TS SDK Dapp Examples

This monorepo contains example applications demonstrating the usage of the Swig protocol in different contexts.

## What's inside?

This monorepo includes the following packages/apps:

### Apps and Packages

- `legacy-dapp-example`: Example integration with legacy (Web3.js 1.0) dApps
- `wallet-standard-dapp`: Example integration with Wallet Standard compatible dApps
- `swig-native-dapp`: Example of a Swig-native application
- `in-app-wallet-example`: Example of an application with an in-app wallet
- `ui`: A shared UI package with common components
- `eslint-config-custom`: Shared ESLint configurations
- `tsconfig`: Shared TypeScript configurations

### Utilities

This turborepo has some additional tools already set up for you:

- [TypeScript](https://www.typescriptlang.org/) for static type checking
- [ESLint](https://eslint.org/) for code linting
- [Prettier](https://prettier.io) for code formatting

### Build

To build all apps and packages, run the following command:

```
yarn build
```

### Develop

To develop all apps and packages simultaneously, run the following command:

```
yarn dev
```

You can also develop individual apps using these commands:

```bash
# Run wallet standard dapp
yarn dev:wallet-standard

# Run legacy dapp
yarn dev:legacy-dapp

# Run swig native dapp
yarn dev:swig-native

# Run in-app wallet example
yarn dev:in-app-wallet
```
