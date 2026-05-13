import {
  createSwigFetchHandler,
  type CreateSwigFetchHandlerConfig,
  type SwigFetchHandler,
} from './fetch.js';

export type CreateSwigRouteHandlersConfig = CreateSwigFetchHandlerConfig;

export type { SwigProxyRoute, SwigRouteContext } from './fetch.js';

export function createSwigRouteHandlers(
  config: CreateSwigRouteHandlersConfig = {},
): { POST: SwigFetchHandler } {
  return {
    POST: createSwigFetchHandler(config),
  };
}
