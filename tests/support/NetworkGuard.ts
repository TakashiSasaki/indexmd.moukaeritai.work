import http from 'http';
import https from 'https';

export function installNetworkGuard(options?: { allow?: (url: string) => boolean }) {
  const originalFetch = global.fetch;
  const originalHttpRequest = http.request;
  const originalHttpGet = http.get;
  const originalHttpsRequest = https.request;
  const originalHttpsGet = https.get;

  const checkAllowed = (urlObj: any) => {
    const urlStr = typeof urlObj === 'string' ? urlObj : (urlObj?.href || urlObj?.url || String(urlObj));
    if (options?.allow && options.allow(urlStr)) return;
    throw new Error(`[NetworkGuard] Unexpected network request to ${urlStr}`);
  };

  global.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const urlStr = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
    if (options?.allow && options.allow(urlStr)) {
      return originalFetch(input, init);
    }
    throw new Error(`[NetworkGuard] Unexpected network request to ${urlStr}`);
  };

  const isSupertest = (args: any[]) => {
    const opts = typeof args[0] === 'object' ? args[0] : (args.length > 1 && typeof args[1] === 'object' ? args[1] : null);
    if (opts && (opts.port || opts.socketPath || opts.host === '127.0.0.1')) return true;
    return false;
  };

  // @ts-ignore
  http.request = (...args: any[]) => {
    if (!isSupertest(args)) checkAllowed(args[0]);
    return originalHttpRequest.apply(http, args as any);
  };
  // @ts-ignore
  http.get = (...args: any[]) => {
    if (!isSupertest(args)) checkAllowed(args[0]);
    return originalHttpGet.apply(http, args as any);
  };

  // @ts-ignore
  https.request = (...args: any[]) => {
    if (!isSupertest(args)) checkAllowed(args[0]);
    return originalHttpsRequest.apply(https, args as any);
  };
  // @ts-ignore
  https.get = (...args: any[]) => {
    if (!isSupertest(args)) checkAllowed(args[0]);
    return originalHttpsGet.apply(https, args as any);
  };

  return () => {
    global.fetch = originalFetch;
    http.request = originalHttpRequest;
    http.get = originalHttpGet;
    https.request = originalHttpsRequest;
    https.get = originalHttpsGet;
  };
}
