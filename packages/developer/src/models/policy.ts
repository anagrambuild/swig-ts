import type { ActionConfig, AuthorityConfig } from '@swig-wallet/api';
import type { Actions, AuthorityInfo } from '@swig-wallet/lib';
import { actionsFromConfig } from '../converters/actions.js';
import { authorityFromConfig } from '../converters/authority.js';

export interface PolicyConfig {
  id: string;
  name: string;
  authority: AuthorityConfig | null;
  actions: ActionConfig[];
}

export class Policy {
  readonly id: string;
  readonly name: string;
  readonly authority: AuthorityInfo | null;
  readonly actions: Actions;

  private constructor(
    id: string,
    name: string,
    authority: AuthorityInfo | null,
    actions: Actions,
  ) {
    this.id = id;
    this.name = name;
    this.authority = authority;
    this.actions = actions;
  }

  static fromConfig = (config: PolicyConfig): Policy => {
    const authority = config.authority
      ? authorityFromConfig(config.authority)
      : null;

    const actions = actionsFromConfig(config.actions);

    return new Policy(config.id, config.name, authority, actions);
  };
}
