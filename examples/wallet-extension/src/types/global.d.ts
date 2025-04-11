import { SwigWallet } from '../pages/content/types';

declare global {
  interface Window {
    swigWallet: SwigWallet;
  }
}

export {};
