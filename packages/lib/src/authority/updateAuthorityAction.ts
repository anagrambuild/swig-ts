import { getU16Encoder } from '@solana/kit';
import {
  getPermissionU8Encoder,
  getUpdateAuthorityKindEncoder,
  Permission,
  UpdateAuthorityKind,
} from '@swig-wallet/coder';
import type { Actions } from '../actions';

export interface UpdateAuthorityActionsInfo {
  data: Uint8Array;
  kind: UpdateAuthorityKind;
}

export function updateAuthorityReplaceAllActions(
  actions: Actions,
): UpdateAuthorityActionsInfo {
  const actionsBytes = actions.bytes();

  const kind = UpdateAuthorityKind.ReplaceAll;
  const kindBytes = getUpdateAuthorityKindEncoder().encode(kind);

  const data = new Uint8Array(kindBytes.length + actionsBytes.length);
  data.set(kindBytes);
  data.set(actionsBytes, kindBytes.length);

  return { data, kind };
}

export function updateAuthorityAddActions(
  actions: Actions,
): UpdateAuthorityActionsInfo {
  const actionsBytes = actions.bytes();

  const kind = UpdateAuthorityKind.AddActions;
  const kindBytes = getUpdateAuthorityKindEncoder().encode(kind);

  const data = new Uint8Array(kindBytes.length + actionsBytes.length);
  data.set(kindBytes);
  data.set(actionsBytes, kindBytes.length);

  return { data, kind };
}

export function updateAuthorityRemoveByType(
  actionTypes: Array<Permission>,
): UpdateAuthorityActionsInfo {
  const kind = UpdateAuthorityKind.RemoveActionsByType;
  const kindBytes = getUpdateAuthorityKindEncoder().encode(kind);

  const data = new Uint8Array(kindBytes.length + actionTypes.length);

  data.set(kindBytes);

  actionTypes.forEach((kind, index) => {
    const bytes = getPermissionU8Encoder().encode(kind);
    data.set(bytes, index + kindBytes.length);
  });
  return { data, kind };
}

export function updateAuthorityRemoveByIndex(
  actionIndices: Array<number>,
): UpdateAuthorityActionsInfo {
  const kind = UpdateAuthorityKind.RemoveActionsByIndex;
  const kindBytes = getUpdateAuthorityKindEncoder().encode(kind);

  const uniqueIndices = [...new Set(actionIndices)];

  const data = new Uint8Array(kindBytes.length + uniqueIndices.length * 2);

  data.set(kindBytes);
  uniqueIndices.forEach((actionIndex, index) => {
    const bytes = getU16Encoder().encode(actionIndex);
    data.set(bytes, kindBytes.length + index * 2);
  });

  return { data, kind };
}
