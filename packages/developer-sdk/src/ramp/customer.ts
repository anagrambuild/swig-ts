import type { RampCustomerContext } from '../types/ramp.js';

export interface DirectSwigUserRampCustomerArgs {
  partnerApplicationId?: string;
  swigUserId: string;
}

export interface PartnerCustomerRampCustomerArgs {
  partnerApplicationId: string;
  externalCustomerId: string;
}

export interface PartnerBusinessRampCustomerArgs {
  partnerApplicationId: string;
  externalBusinessId: string;
}

export const rampCustomer = {
  directSwigUser(args: DirectSwigUserRampCustomerArgs): RampCustomerContext {
    return {
      ...optionalPartnerApplicationId(args.partnerApplicationId),
      swigUserId: requireNonEmpty(args.swigUserId, 'swigUserId'),
      customerType: 'individual',
    };
  },

  partnerCustomer(args: PartnerCustomerRampCustomerArgs): RampCustomerContext {
    return {
      partnerApplicationId: requireNonEmpty(
        args.partnerApplicationId,
        'partnerApplicationId',
      ),
      externalCustomerId: requireNonEmpty(
        args.externalCustomerId,
        'externalCustomerId',
      ),
      customerType: 'individual',
    };
  },

  partnerBusiness(args: PartnerBusinessRampCustomerArgs): RampCustomerContext {
    return {
      partnerApplicationId: requireNonEmpty(
        args.partnerApplicationId,
        'partnerApplicationId',
      ),
      externalBusinessId: requireNonEmpty(
        args.externalBusinessId,
        'externalBusinessId',
      ),
      customerType: 'business',
    };
  },
} as const;

function optionalPartnerApplicationId(
  partnerApplicationId: string | undefined,
): Pick<RampCustomerContext, 'partnerApplicationId'> | Record<string, never> {
  return partnerApplicationId?.trim() ? { partnerApplicationId } : {};
}

function requireNonEmpty(value: string, fieldName: string): string {
  if (!value.trim()) {
    throw new Error(`${fieldName} is required`);
  }
  return value;
}
