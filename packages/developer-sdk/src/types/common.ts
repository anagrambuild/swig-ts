export type Network = 'mainnet' | 'devnet';

export type Amount = bigint | number | string;

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type JsonObject = Record<string, JsonValue>;
