# Wallet Extension

A browser extension wallet built with React, TypeScript, and Vite, designed to test and demonstrate the `@swig/classic` package functionality.

## Features

- React-based UI with TypeScript
- Fast development with Vite
- Browser extension for Chrome/Firefox/Edge
- Type-safe wallet functionality
- Modern development experience
- Integration with `@swig/classic` package for Solana wallet functionality

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher recommended)
- Yarn package manager (for building the wallet extension)
- Bun package manager (for building the classic package)

### Installation

1. Clone the monorepo:

   ```bash
   git clone https://github.com/anagrambuild/swig-ts.git
   cd swig-ts/examples/wallet-extension
   ```

2. Install dependencies:
   ```bash
   yarn
   ```

3. Build and link the classic package:
   ```bash
   yarn update-classic
   ```
   This will:
   - Build the classic package using bun
   - Install the classic package in the wallet extension using yarn

### Development

1. Start the development server:

   ```bash
   yarn dev
   ```

2. Build the extension:

   ```bash
   yarn build
   ```

3. Load the extension in your browser:
   - Chrome/Edge: Go to `chrome://extensions/`, enable "Developer mode", click "Load unpacked", and select the `dist` folder
   - Firefox: Go to `about:debugging#/runtime/this-firefox`, click "Load Temporary Add-on", and select any file in the `dist` folder

### Project Structure

```
swig-ts/
├── examples/
│   └── wallet-extension/     # This project
│       ├── public/
│       │   ├── icons/        # Extension icons
│       │   └── manifest.json # Extension manifest
│       ├── src/
│       │   ├── pages/
│       │   │   ├── popup/    # Extension popup UI
│       │   │   ├── options/  # Options page
│       │   │   ├── background/ # Background scripts (TypeScript)
│       │   │   └── content/  # Content scripts (TypeScript)
│       │   ├── components/   # Shared React components
│       │   ├── types/        # TypeScript type definitions
│       │   ├── App.tsx       # Main React component
│       │   └── main.tsx      # Entry point
│       ├── tsconfig.json     # TypeScript configuration
│       ├── tsconfig.node.json # Node-specific TS configuration
│       └── vite.config.ts    # Vite configuration
└── packages/
    └── classic/             # The @swig/classic package used by this extension
```

### Updating the Classic Package

When changes are made to the `@swig/classic` package, you'll need to rebuild and reinstall it:

```bash
yarn update-classic
```

This command will:
1. Build the latest version of the classic package
2. Install it in the wallet extension
3. Update all necessary dependencies

## Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin feature/my-new-feature`
5. Submit a pull request

## Technologies

- [React](https://reactjs.org/)
- [Typescript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/)
- [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin)
- [@swig/classic](https://github.com/anagrambuild/swig-ts/tree/main/packages/classic) - Solana wallet functionality

## React + Vite

This project was bootstrapped with Vite. It provides:

- HMR (Hot Module Replacement)
- ESLint integration
- Fast development experience

The project uses:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) which uses [Babel](https://babeljs.io/) for Fast Refresh

## License

[MIT](LICENSE)
