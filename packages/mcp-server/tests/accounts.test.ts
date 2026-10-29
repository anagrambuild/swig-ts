import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Connection, Keypair } from '@solana/web3.js';
import {
  Actions,
  createEd25519AuthorityInfo,
  findSwigPda,
  getAddAuthorityInstructions,
  getCreateSwigInstruction,
  getRemoveAuthorityInstructions,
  getUpdateAuthorityInstructions,
  updateAuthorityReplaceAllActions,
} from '@swig-wallet/classic';
import { describe, expect, test } from 'bun:test';
import { fetchSwig, getFundedKeys, getSvm } from '../../classic/tests/context';
import { randomBytes, sendSVMTransaction } from '../../classic/tests/utils';
import { appendRentClaimer, requireNoTokenAccounts } from '../src/accounts';
import { readSwigTail, setRentClaimerInstruction } from '../src/protocol';

describe('wallet lifecycle accounts', () => {
  for (const operation of ['shrink', 'remove'] as const) {
    test(`${operation} authority refunds the immutable rent claimer`, async () => {
      const svm = getSvm();
      const [root, delegate, claimer] = getFundedKeys(svm, 3);
      const id = randomBytes(32);
      const address = findSwigPda(id);
      sendSVMTransaction(
        svm,
        [
          await getCreateSwigInstruction({
            id,
            payer: root.publicKey,
            authorityInfo: createEd25519AuthorityInfo(root.publicKey),
            actions: Actions.set().all().get(),
          }),
        ],
        root,
      );
      sendSVMTransaction(
        svm,
        [
          setRentClaimerInstruction({
            swig: address,
            payer: root.publicKey,
            signer: root.publicKey,
            roleId: 0,
            rentClaimer: claimer.publicKey,
          }),
        ],
        root,
      );
      sendSVMTransaction(
        svm,
        await getAddAuthorityInstructions(
          fetchSwig(svm, address),
          0,
          createEd25519AuthorityInfo(delegate.publicKey),
          Actions.set().solLimit({ amount: 1_000_000n }).get(),
        ),
        root,
      );
      const swig = fetchSwig(svm, address);
      const ixs =
        operation === 'shrink'
          ? await getUpdateAuthorityInstructions(
              swig,
              0,
              1,
              updateAuthorityReplaceAllActions(
                Actions.set().programAll().get(),
              ),
            )
          : await getRemoveAuthorityInstructions(swig, 0, 1);
      const account = svm.getAccount(address)!;
      appendRentClaimer(
        ixs,
        readSwigTail(Buffer.from(account.data)).rentClaimer,
      );
      const before = svm.getBalance(claimer.publicKey)!;
      sendSVMTransaction(svm, ixs, root);
      expect(svm.getBalance(claimer.publicKey)!).toBeGreaterThan(before);
      const updated = fetchSwig(svm, address);
      if (operation === 'remove') expect(updated.findRoleById(1)).toBeNull();
      else expect(updated.findRoleById(1)!.actions.solSpendLimit()).toBe(0n);
    });
  }

  for (const program of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    for (const amount of [0n, 1n]) {
      test(`close rejects ${program.toBase58()} accounts with balance ${amount}`, async () => {
        const owner = Keypair.generate().publicKey;
        const token = Keypair.generate().publicKey;
        const queried: string[] = [];
        const conn = new Connection('http://localhost:8899', {
          fetch: async (_input, init) => {
            const request = JSON.parse(String(init?.body)) as {
              id: string;
              params: [string, { programId: string }];
            };
            expect(request.params[0]).toBe(owner.toBase58());
            queried.push(request.params[1].programId);
            const data = Buffer.alloc(165);
            owner.toBuffer().copy(data, 32);
            data.writeBigUInt64LE(amount, 64);
            return new Response(
              JSON.stringify({
                jsonrpc: '2.0',
                id: request.id,
                result: {
                  context: { slot: 1 },
                  value:
                    request.params[1].programId === program.toBase58()
                      ? [
                          {
                            pubkey: token.toBase58(),
                            account: {
                              data: [data.toString('base64'), 'base64'],
                              executable: false,
                              lamports: 2_039_280,
                              owner: program.toBase58(),
                              rentEpoch: 0,
                            },
                          },
                        ]
                      : [],
                },
              }),
            );
          },
        });
        await expect(requireNoTokenAccounts(conn, owner)).rejects.toThrow(
          token.toBase58(),
        );
        expect(queried.sort()).toEqual(
          [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]
            .map((p) => p.toBase58())
            .sort(),
        );
      });
    }
  }

  test('close fails when the RPC cannot enumerate token accounts', async () => {
    const conn = new Connection('http://localhost:8899', {
      fetch: async () => {
        throw new Error('RPC unavailable');
      },
    });
    await expect(
      requireNoTokenAccounts(conn, Keypair.generate().publicKey),
    ).rejects.toThrow('RPC unavailable');
  });
});
