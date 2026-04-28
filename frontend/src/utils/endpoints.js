export function normalizeEndpointPath(path) {
  const trimmed = (path || '').trim();
  if (!trimmed) return '/';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function buildSuggestedOperationId(method, path) {
  const normalizedPath = normalizeEndpointPath(path);
  const parts = normalizedPath
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map(segment => {
      const paramMatch = segment.match(/^\{(.+)\}$/);
      return paramMatch ? `by-${paramMatch[1]}` : segment;
    });

  const base = [String(method || 'get').toLowerCase(), ...parts].join('-') || 'get-root';
  const safe = base
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return safe.replace(/-([a-zA-Z0-9])/g, (_, char) => char.toUpperCase());
}
