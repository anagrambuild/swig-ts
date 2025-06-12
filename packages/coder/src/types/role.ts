// import { getBytesDecoder, getStructDecoder, transformDecoder, type ReadonlyUint8Array } from '@solana/kit';
// import { getPositionDecoder, type Position } from '.';

// export type Role = {
//   position: Position;
//   data: ReadonlyUint8Array;
// };

// export function getRoleDecoder() {
//   return transformDecoder(
//     getStructDecoder([
//       ["position", getPositionDecoder()],
//       ["data", getBytesDecoder()],
//     ]),
//     (value) => {
//       value.
//     }
//   )
// }
