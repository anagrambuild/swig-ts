import { describe, expect, test } from 'bun:test';

import { SwigClient } from '../server/typescript/index.js';

type CapturedRequest = {
  url: string;
  method?: string;
  headers: Headers;
  body: unknown;
};

function jsonFetch(
  handler: (request: CapturedRequest) => unknown,
): typeof fetch {
  return (async (input, init) => {
    const request = new Request(input, init);
    const text = await request.text();

    return new Response(
      JSON.stringify(
        handler({
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: text ? JSON.parse(text) : undefined,
        }),
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }) as typeof fetch;
}

describe('RampClient', () => {
  test('normalizes ramp country subdivision options', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigClient({
      apiKey: 'sk_test',
      baseUrl: 'http://localhost:8080',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          country_codes: ['GB', 'US'],
          countries: [
            {
              country_code: 'GB',
              country_name: 'United Kingdom',
              subdivisions: [],
            },
            {
              country_code: 'US',
              country_name: 'United States',
              subdivisions: [
                {
                  subdivision_code: 'US-CA',
                  subdivision_name: 'California',
                },
                {
                  subdivision_code: 'US-NY',
                  subdivision_name: 'New York',
                },
              ],
            },
          ],
          fiat_currency_codes: ['USD'],
          payment_method_types: ['RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD'],
          crypto_currency_codes: ['USDC_SOLANA'],
        };
      }),
    });

    const result = await swig.ramp.getOptions({
      countryCode: 'US',
      fiatCurrencyCode: 'USD',
    });

    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/wallet/api/ramp/options?countryCode=US&fiatCurrencyCode=USD',
      method: 'GET',
    });
    expect(result).toMatchObject({
      countryCodes: ['GB', 'US'],
      countries: [
        {
          countryCode: 'GB',
          countryName: 'United Kingdom',
          subdivisions: [],
        },
        {
          countryCode: 'US',
          countryName: 'United States',
          subdivisions: [
            {
              subdivisionCode: 'US-CA',
              subdivisionName: 'California',
            },
            {
              subdivisionCode: 'US-NY',
              subdivisionName: 'New York',
            },
          ],
        },
      ],
      fiatCurrencyCodes: ['USD'],
      paymentMethodTypes: ['credit-debit-card'],
      cryptoCurrencyCodes: ['USDC_SOLANA'],
    });
  });

  test('falls back to country codes when country options are absent', async () => {
    const swig = new SwigClient({
      apiKey: 'sk_test',
      baseUrl: 'http://localhost:8080',
      network: 'devnet',
      fetch: jsonFetch(() => ({
        country_codes: ['US'],
        fiat_currency_codes: ['USD'],
        payment_method_types: ['RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD'],
        crypto_currency_codes: ['USDC_SOLANA'],
      })),
    });

    await expect(swig.ramp.getOptions({})).resolves.toMatchObject({
      countryCodes: ['US'],
      countries: [
        {
          countryCode: 'US',
          countryName: 'US',
          subdivisions: [],
        },
      ],
    });
  });

  test('quotes ramp options through the backend API with proto wire enums', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigClient({
      apiKey: 'sk_test',
      baseUrl: 'http://localhost:8080',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        return {
          quotes: [
            {
              quote_id: 'quote_123',
              direction: 'RAMP_DIRECTION_ONRAMP',
              service_provider: 'RAMP_SERVICE_PROVIDER_OTHER',
              payment_method_type: 'RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD',
              source_amount: '100.00',
              source_currency_code: 'USD',
              destination_amount: '99.00',
              destination_currency_code: 'USDC_SOLANA',
              exchange_rate: '0.99',
              total_fee: '1.00',
              network_fee: '0.10',
              transaction_fee: '0.70',
              partner_fee: '0.20',
              ramp_score: '92.5',
              low_kyc: true,
            },
          ],
        };
      }),
    });

    const result = await swig.ramp.quote({
      customer: {
        partnerApplicationId: 'app_123',
        swigUserId: 'user_123',
        customerType: 'individual',
      },
      wallet: {
        walletId: 'wallet_123',
        walletAddress: 'wallet_address_123',
        network: 'devnet',
      },
      direction: 'onramp',
      sourceAmount: '100.00',
      sourceCurrencyCode: 'USD',
      destinationCurrencyCode: 'USDC_SOLANA',
      countryCode: 'US',
      paymentMethodType: 'credit-debit-card',
      serviceProviders: ['other'],
    });

    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/wallet/api/ramp/quote',
      method: 'POST',
      body: {
        customer: {
          partnerApplicationId: 'app_123',
          swigUserId: 'user_123',
          customerType: 'RAMP_CUSTOMER_TYPE_INDIVIDUAL',
        },
        wallet: {
          walletId: 'wallet_123',
          walletAddress: 'wallet_address_123',
          network: 'NETWORK_DEVNET',
        },
        direction: 'RAMP_DIRECTION_ONRAMP',
        sourceAmount: '100.00',
        sourceCurrencyCode: 'USD',
        destinationCurrencyCode: 'USDC_SOLANA',
        countryCode: 'US',
        paymentMethodType: 'RAMP_PAYMENT_METHOD_TYPE_CREDIT_DEBIT_CARD',
        serviceProviders: ['RAMP_SERVICE_PROVIDER_OTHER'],
      },
    });
    expect(calls[0]?.headers.get('authorization')).toBe('Bearer sk_test');
    expect(result.quotes[0]).toMatchObject({
      quoteId: 'quote_123',
      direction: 'onramp',
      serviceProvider: 'other',
      paymentMethodType: 'credit-debit-card',
      rampScore: '92.5',
      lowKyc: true,
    });
  });

  test('creates sessions and lists ramp transaction history', async () => {
    const calls: CapturedRequest[] = [];
    const swig = new SwigClient({
      apiKey: 'sk_test',
      baseUrl: 'http://localhost:8080',
      network: 'devnet',
      fetch: jsonFetch((request) => {
        calls.push(request);
        if (request.method === 'POST') {
          return {
            local_session_id: 'session_local_123',
            meld_session_id: 'meld_session_123',
            external_customer_id: 'customer_123',
            external_session_id: 'swig:ramp:on:wallet_123:session_123',
            launch_url: 'https://provider.example/launch',
            fallback_launch_url: 'https://meld.example/widget',
          };
        }
        return {
          transactions: [
            {
              transaction_id: 'txn_123',
              meld_transaction_id: 'meld_txn_123',
              meld_session_id: 'meld_session_123',
              wallet_id: 'wallet_123',
              direction: 'RAMP_DIRECTION_ONRAMP',
              transaction_type: 'RAMP_TRANSACTION_TYPE_CRYPTO_PURCHASE',
              status: 'RAMP_TRANSACTION_STATUS_PENDING',
              service_provider: 'RAMP_SERVICE_PROVIDER_OTHER',
              payment_method_type: 'RAMP_PAYMENT_METHOD_TYPE_ACH',
              source_amount: '100.00',
              source_currency_code: 'USD',
              destination_amount: '99.00',
              destination_currency_code: 'USDC_SOLANA',
              created_at: '2026-06-06T00:00:00Z',
              updated_at: '2026-06-06T00:01:00Z',
            },
          ],
        };
      }),
    });

    const session = await swig.ramp.createSession({
      customer: {
        swigUserId: 'user_123',
        customerType: 'individual',
      },
      wallet: {
        walletId: 'wallet_123',
        walletAddress: 'wallet_address_123',
        network: 'devnet',
      },
      direction: 'onramp',
      selectedQuoteId: 'quote_123',
      sourceAmount: '100.00',
      sourceCurrencyCode: 'USD',
      destinationCurrencyCode: 'USDC_SOLANA',
      countryCode: 'US',
      serviceProvider: 'other',
      paymentMethodType: 'ach',
      redirectUrl: 'https://app.example/ramp/return',
    });
    const history = await swig.ramp.listTransactions({
      walletId: 'wallet_123',
      direction: 'onramp',
      status: 'pending',
      limit: 25,
    });

    expect(calls[0]).toMatchObject({
      url: 'http://localhost:8080/wallet/api/ramp/sessions',
      method: 'POST',
      body: {
        direction: 'RAMP_DIRECTION_ONRAMP',
        selectedQuoteId: 'quote_123',
        serviceProvider: 'RAMP_SERVICE_PROVIDER_OTHER',
        paymentMethodType: 'RAMP_PAYMENT_METHOD_TYPE_ACH',
        redirectUrl: 'https://app.example/ramp/return',
      },
    });
    expect(session).toMatchObject({
      localSessionId: 'session_local_123',
      meldSessionId: 'meld_session_123',
      launchUrl: 'https://provider.example/launch',
      fallbackLaunchUrl: 'https://meld.example/widget',
    });
    expect(calls[1]).toMatchObject({
      url: 'http://localhost:8080/wallet/api/ramp/wallets/wallet_123/transactions?network=NETWORK_DEVNET&direction=RAMP_DIRECTION_ONRAMP&status=RAMP_TRANSACTION_STATUS_PENDING&limit=25',
      method: 'GET',
    });
    expect(history.transactions[0]).toMatchObject({
      transactionId: 'txn_123',
      transactionType: 'crypto-purchase',
      status: 'pending',
      paymentMethodType: 'ach',
    });
  });
});
