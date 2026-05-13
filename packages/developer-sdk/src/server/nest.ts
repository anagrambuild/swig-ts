import {
  createSwigFetchHandler,
  type CreateSwigFetchHandlerConfig,
} from './fetch.js';

export type CreateSwigNestHandlerConfig = CreateSwigFetchHandlerConfig;

export interface SwigNestRequestLike {
  body?: unknown;
  headers?: Record<string, string | string[] | number | undefined>;
  hostname?: string;
  method?: string;
  originalUrl?: string;
  protocol?: string;
  url?: string;
  get?: (name: string) => string | undefined;
}

export interface SwigNestResponseLike {
  header?: (name: string, value: string) => unknown;
  send: (body?: string) => unknown;
  setHeader?: (name: string, value: string) => unknown;
  status: (statusCode: number) => SwigNestResponseLike;
}

export type SwigNestHandler = (
  request: SwigNestRequestLike,
  response: SwigNestResponseLike,
) => Promise<void>;

export function createSwigNestHandler(
  config: CreateSwigNestHandlerConfig = {},
): SwigNestHandler {
  const fetchHandler = createSwigFetchHandler(config);

  return async (request, response) => {
    const fetchResponse = await fetchHandler(toFetchRequest(request));
    response.status(fetchResponse.status);
    fetchResponse.headers.forEach((value, name) => {
      if (response.setHeader) {
        response.setHeader(name, value);
      } else {
        response.header?.(name, value);
      }
    });
    response.send(await fetchResponse.text());
  };
}

function toFetchRequest(request: SwigNestRequestLike): Request {
  const method = request.method ?? 'POST';
  const headers = toHeaders(request.headers);

  return new Request(readUrl(request), {
    method,
    headers,
    body:
      method === 'GET' || method === 'HEAD' ? undefined : toBody(request.body),
  });
}

function readUrl(request: SwigNestRequestLike): string {
  const url = request.originalUrl ?? request.url ?? '/';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const forwardedProto = readHeader(request.headers, 'x-forwarded-proto');
  const protocol = request.protocol ?? forwardedProto ?? 'http';
  const host =
    request.get?.('host') ??
    readHeader(request.headers, 'host') ??
    request.hostname ??
    'localhost';

  return `${protocol}://${host}${url.startsWith('/') ? url : `/${url}`}`;
}

function toHeaders(headers: SwigNestRequestLike['headers'] = {}): Headers {
  const output = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        output.append(name, item);
      }
      continue;
    }
    output.set(name, String(value));
  }
  return output;
}

function readHeader(
  headers: SwigNestRequestLike['headers'] = {},
  key: string,
): string | undefined {
  const value = headers[key] ?? headers[key.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value === undefined ? undefined : String(value);
}

function toBody(body: unknown): BodyInit | undefined {
  if (body === undefined) {
    return undefined;
  }
  if (typeof body === 'string' || body instanceof URLSearchParams) {
    return body;
  }
  return JSON.stringify(body);
}
