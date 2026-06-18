import { describe, expect, test } from 'bun:test';

import { rampCustomer } from './customer.js';

describe('rampCustomer', () => {
  test('builds direct Swig user context', () => {
    expect(
      rampCustomer.directSwigUser({
        organizationId: 'org_123',
        swigUserId: 'user_123',
      }),
    ).toEqual({
      organizationId: 'org_123',
      swigUserId: 'user_123',
      customerType: 'individual',
    });
  });

  test('preserves optional partner application id for direct Swig users', () => {
    expect(
      rampCustomer.directSwigUser({
        organizationId: 'org_123',
        partnerApplicationId: 'app_123',
        swigUserId: 'user_123',
      }),
    ).toEqual({
      organizationId: 'org_123',
      partnerApplicationId: 'app_123',
      swigUserId: 'user_123',
      customerType: 'individual',
    });
  });

  test('builds downstream partner customer context', () => {
    expect(
      rampCustomer.partnerCustomer({
        organizationId: 'org_123',
        partnerApplicationId: 'app_123',
        externalCustomerId: 'customer_123',
      }),
    ).toEqual({
      organizationId: 'org_123',
      partnerApplicationId: 'app_123',
      externalCustomerId: 'customer_123',
      customerType: 'individual',
    });
  });

  test('builds downstream partner business context', () => {
    expect(
      rampCustomer.partnerBusiness({
        organizationId: 'org_123',
        partnerApplicationId: 'app_123',
        externalBusinessId: 'business_123',
      }),
    ).toEqual({
      organizationId: 'org_123',
      partnerApplicationId: 'app_123',
      externalBusinessId: 'business_123',
      customerType: 'business',
    });
  });

  test('rejects blank required ids', () => {
    expect(() =>
      rampCustomer.partnerCustomer({
        organizationId: 'org_123',
        partnerApplicationId: '',
        externalCustomerId: 'customer_123',
      }),
    ).toThrow('partnerApplicationId is required');
  });
});
