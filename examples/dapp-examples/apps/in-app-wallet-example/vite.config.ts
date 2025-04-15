import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@solana/web3.js'],
    exclude: ['@solana/addresses', '@solana/codecs', '@solana/instructions'],
  },
  resolve: {
    preserveSymlinks: true,
  },
});
