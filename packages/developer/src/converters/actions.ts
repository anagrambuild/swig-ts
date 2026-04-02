import type { ActionConfig } from '@swig-wallet/api';
import { type Actions, ActionsBuilder } from '@swig-wallet/lib';

export function actionsFromConfig(actions: ActionConfig[]): Actions {
  const builder = ActionsBuilder.new();

  for (const action of actions) {
    switch (action.type) {
      case 'All':
        builder.all();
        break;

      case 'AllButManageAuthority':
        builder.allButManageAuthority();
        break;

      case 'ManageAuthority':
        builder.manageAuthority();
        break;

      case 'CloseSwigAuthority':
        builder.closeSwigAuthority();
        break;

      case 'RentDestination':
        builder.rentDestination();
        break;

      case 'SolLimit':
        builder.solLimit({ amount: BigInt(action.amount) });
        break;

      case 'SolRecurringLimit':
        builder.solRecurringLimit({
          recurringAmount: BigInt(action.recurringAmount),
          window: BigInt(action.window),
        });
        break;

      case 'SolDestinationLimit':
        builder.solDestinationLimit({
          amount: BigInt(action.amount),
          destination: action.destination,
        });
        break;

      case 'SolRecurringDestinationLimit':
        builder.solRecurringDestinationLimit({
          recurringAmount: BigInt(action.recurringAmount),
          window: BigInt(action.window),
          destination: action.destination,
        });
        break;

      case 'TokenLimit':
        builder.tokenLimit({
          mint: action.mint,
          amount: BigInt(action.amount),
        });
        break;

      case 'TokenRecurringLimit':
        builder.tokenRecurringLimit({
          mint: action.mint,
          recurringAmount: BigInt(action.recurringAmount),
          window: BigInt(action.window),
        });
        break;

      case 'TokenDestinationLimit':
        builder.tokenDestinationLimit({
          mint: action.mint,
          amount: BigInt(action.amount),
          destination: action.destination,
        });
        break;

      case 'TokenRecurringDestinationLimit':
        builder.tokenRecurringDestinationLimit({
          mint: action.mint,
          recurringAmount: BigInt(action.recurringAmount),
          window: BigInt(action.window),
          destination: action.destination,
        });
        break;

      case 'Program':
        builder.programLimit({ programId: action.programId });
        break;

      case 'ProgramAll':
        builder.programAll();
        break;

      case 'ProgramCurated':
        builder.programCurated();
        break;

      case 'StakeLimit':
        builder.stakeLimit({ amount: BigInt(action.amount) });
        break;

      case 'StakeRecurringLimit':
        builder.stakeRecurringLimit({
          recurringAmount: BigInt(action.recurringAmount),
          window: BigInt(action.window),
        });
        break;

      case 'StakeAll':
        builder.stakeAll();
        break;

      case 'SubAccount':
        builder.subAccount();
        break;

      default:
        throw new Error(
          `Unknown action type: ${(action as ActionConfig).type}`,
        );
    }
  }

  return builder.get();
}
