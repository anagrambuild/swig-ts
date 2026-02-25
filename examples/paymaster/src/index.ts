/**
 * Swig Paymaster Examples
 *
 * This package contains example implementations for using the Swig Paymaster SDK.
 * See the individual example files for usage:
 * - classic.ts: Example using @swig-paymaster/classic (web3.js 1.x)
 * - kit.ts: Example using @swig-paymaster/kit (web3.js 2.0)
 */

// Re-export with namespaces to avoid conflicts
import * as Classic from '@swig-paymaster/classic';
import * as Kit from '@swig-paymaster/kit';

export { Classic, Kit };
