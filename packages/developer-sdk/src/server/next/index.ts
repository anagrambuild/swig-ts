import {
  createSwigFetchHandler,
  createSwigGetHandler,
  type CreateSwigFetchHandlerConfig,
  type SwigFetchHandler,
} from '../fetch/index.js';

export type CreateSwigRouteHandlersConfig = CreateSwigFetchHandlerConfig;

export type { SwigProxyRoute, SwigRouteContext } from '../fetch/index.js';

export function createSwigRouteHandlers(
  config: CreateSwigRouteHandlersConfig = {},
): { GET: SwigFetchHandler; POST: SwigFetchHandler } {
  return {
    GET: createSwigGetHandler(config),
    POST: createSwigFetchHandler(config),
  };
}
