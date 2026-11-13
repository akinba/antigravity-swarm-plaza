export function isPluginScheme(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.location.protocol !== 'http:' &&
    window.location.protocol !== 'https:'
  );
}

export function getSidecarToken(): string {
  if (typeof window === 'undefined') return '';
  const paramToken = new URLSearchParams(window.location.search).get('token');
  if (paramToken) return paramToken;
  const sidecarWin = window as unknown as { sidecar?: { token?: string } };
  return sidecarWin.sidecar?.token || '';
}

export async function sidecarFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const token = getSidecarToken();
  if (!token) {
    return fetch(url, init);
  }
  let targetUrl = url;
  if (url.startsWith('/') && !/[?&]token=/.test(url)) {
    const sep = url.includes('?') ? '&' : '?';
    targetUrl = `${url}${sep}token=${encodeURIComponent(token)}`;
  }
  const headers = new Headers(init.headers);
  if (!headers.has('X-Sidecar-Token')) {
    headers.set('X-Sidecar-Token', token);
  }
  return fetch(targetUrl, { ...init, headers });
}

export function buildSidecarWsUrl(): string {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const base = `${proto}//${window.location.host}/ws`;
  const token = getSidecarToken();
  return token ? `${base}?token=${encodeURIComponent(token)}` : base;
}
