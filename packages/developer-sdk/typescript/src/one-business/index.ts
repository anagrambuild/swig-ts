import type { JsonObject } from '../types/index.js';

export const DEFAULT_ONE_BUSINESS_URL = 'https://swig-one-business.vercel.app';

export type OneBusinessGrantAccessAction = JsonObject;

export interface BuildOneBusinessGrantAccessUrlArgs {
  swigPubkey: string;
  authorityPublicKey: string;
  actions?: OneBusinessGrantAccessAction[];
  appName?: string;
  oneBusinessUrl?: string;
  redirectUri?: string;
  state?: string;
}

export interface RedirectToOneBusinessGrantAccessOptions {
  mode?: 'assign' | 'replace';
  location?: Pick<Location, 'assign' | 'replace'>;
}

export interface OneBusinessGrantAccessResult {
  status: string;
  swigPubkey: string;
  walletAddress: string;
  roleId: number;
  authorityPublicKey: string;
  signature?: string;
  state?: string;
}

export type OneBusinessGrantAccessCallbackInput =
  | string
  | URL
  | Pick<Location, 'href'>;

export class OneBusinessGrantAccessCallbackError extends Error {
  readonly code: string;
  readonly description?: string;
  readonly state?: string;

  constructor(args: { code: string; description?: string; state?: string }) {
    super(args.description ?? args.code);
    this.name = 'OneBusinessGrantAccessCallbackError';
    this.code = args.code;
    this.description = args.description;
    this.state = args.state;
  }
}

export function buildOneBusinessGrantAccessUrl(
  args: BuildOneBusinessGrantAccessUrlArgs,
): string {
  const url = new URL(
    '/authorize/grant-access',
    normalizeBaseUrl(args.oneBusinessUrl ?? DEFAULT_ONE_BUSINESS_URL),
  );

  url.searchParams.set('swig_pubkey', requireNonEmpty(args.swigPubkey));
  url.searchParams.set(
    'authority_public_key',
    requireNonEmpty(args.authorityPublicKey),
  );

  if (args.appName) {
    url.searchParams.set('app_name', args.appName);
  }
  if (args.redirectUri) {
    url.searchParams.set('redirect_uri', args.redirectUri);
  }
  if (args.state) {
    url.searchParams.set('state', args.state);
  }
  if (args.actions !== undefined) {
    url.searchParams.set('actions', encodeBase64UrlJson(args.actions));
  }

  return url.toString();
}

export function redirectToOneBusinessGrantAccess(
  args: BuildOneBusinessGrantAccessUrlArgs,
  options: RedirectToOneBusinessGrantAccessOptions = {},
): void {
  const location = options.location ?? getBrowserLocation();
  const url = buildOneBusinessGrantAccessUrl(args);

  if (options.mode === 'replace') {
    location.replace(url);
    return;
  }

  location.assign(url);
}

export function completeOneBusinessGrantAccess(
  input?: OneBusinessGrantAccessCallbackInput,
): OneBusinessGrantAccessResult {
  const url = new URL(callbackUrl(input));
  const errorCode = readParam(url.searchParams, 'error');
  const state = readParam(url.searchParams, 'state');

  if (errorCode) {
    throw new OneBusinessGrantAccessCallbackError({
      code: errorCode,
      description: readParam(url.searchParams, 'error_description'),
      state,
    });
  }

  const swigPubkey = requireCallbackParam(url.searchParams, 'swig_pubkey');
  const walletAddress = requireCallbackParam(
    url.searchParams,
    'wallet_address',
  );
  const authorityPublicKey = requireCallbackParam(
    url.searchParams,
    'authority_public_key',
  );
  const roleId = Number(requireCallbackParam(url.searchParams, 'role_id'));

  if (!Number.isSafeInteger(roleId) || roleId < 0) {
    throw new Error('Grant access callback has an invalid role_id');
  }

  return {
    status:
      readParam(url.searchParams, 'status') ??
      readParam(url.searchParams, 'grant_status') ??
      'granted',
    swigPubkey,
    walletAddress,
    roleId,
    authorityPublicKey,
    ...(readParam(url.searchParams, 'signature')
      ? { signature: readParam(url.searchParams, 'signature') }
      : {}),
    ...(state ? { state } : {}),
  };
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('oneBusinessUrl is required');
  }
  return trimmed.endsWith('/') ? trimmed : `${trimmed}/`;
}

function requireNonEmpty(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error('swigPubkey and authorityPublicKey are required');
  }
  return trimmed;
}

function encodeBase64UrlJson(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function getBrowserLocation(): Pick<Location, 'assign' | 'replace' | 'href'> {
  if (typeof location === 'undefined') {
    throw new Error('Browser location is not available');
  }
  return location;
}

function callbackUrl(input?: OneBusinessGrantAccessCallbackInput): string {
  if (input === undefined) {
    return getBrowserLocation().href;
  }
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.href;
}

function requireCallbackParam(
  params: URLSearchParams,
  snakeName: string,
): string {
  const value = readParam(params, snakeName);
  if (!value) {
    throw new Error(`Grant access callback is missing ${snakeName}`);
  }
  return value;
}

function readParam(
  params: URLSearchParams,
  snakeName: string,
): string | undefined {
  const camelName = snakeToCamel(snakeName);
  return (
    params.get(snakeName)?.trim() || params.get(camelName)?.trim() || undefined
  );
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase());
}
