import { getAddressCodec, type Address } from '@solana/kit';
import { AuthorityType } from '@swig/coder';
import { Authority } from './abstract';

export class Ed25519Authority extends Authority {
  constructor(public address: Address) {
    let bytes = new Uint8Array(getAddressCodec().encode(address));
    super(bytes, AuthorityType.Ed25519);
  }
}
