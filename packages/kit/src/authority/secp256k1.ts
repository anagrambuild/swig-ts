import { AuthorityType } from '@swig/coder';
import { Authority } from './abstract';

export class Secp256k1Authority extends Authority {
  constructor(public data: any) {
    super(data, AuthorityType.Secp256k1);
  }
}
