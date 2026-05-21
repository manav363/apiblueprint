import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useApp } from '../context/AppContext';
import { MOCK_BASE_URL, api } from '../services/api';

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function extractPathParams(path = '') {
  return [...path.matchAll(/\{([^}]+)\}/g)].map(match => match[1]);
}

function formatJson(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  return JSON.stringify(value, null, 2);
}

function buildQuery(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== '') search.set(key, value);
  });
  const text = search.toString();
  return text ? `?${text}` : '';
}

function resolvePath(path, values) {
  return path.replace(/\{([^}]+)\}/g, (_, name) => encodeURIComponent(values[name] || `sample-${name}`));
}

function defaultBody(endpoint) {
  if (!endpoint || !BODY_METHODS.has(endpoint.method)) return '';
  const response = endpoint.responses?.find(item => String(item.status_code).startsWith('2')) || endpoint.responses?.[0];
  return response?.example || '{\n  "name": "example"\n}';
}

function TesterField({ label, value, onChange, placeholder }) {
  return (
    <label style={{ display: 'grid', gap: 5 }}>
      <span style={{ fontSize: 10, color: '#505050', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</span>
      <input
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        style={{ background: '#111', border: '1px solid #242424', borderRadius: 6, color: '#f0f0f0', padding: '8px 10px', fontSize: 12, outline: 'none', fontFamily: 'var(--mono)' }}
      />
    </label>
  );
}

export default function ApiTester() {
  const { activeProject, endpoints, activeEndpoint, setActiveEndpoint, searchQuery } = useApp();
  const [pathValues, setPathValues] = useState({});
  const [queryValues, setQueryValues] = useState({});
  const [headerValues, setHeaderValues] = useState({});
  const [body, setBody] = useState('');
  const [response, setResponse] = useState(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredEndpoints = useMemo(() => {
    if (!normalizedSearch) return endpoints;
    return endpoints.filter(endpoint => (
      endpoint.path.toLowerCase().includes(normalizedSearch)
      || endpoint.method.toLowerCase().includes(normalizedSearch)
      || endpoint.group_name.toLowerCase().includes(normalizedSearch)
      || (endpoint.summary || '').toLowerCase().includes(normalizedSearch)
      || (endpoint.tag || '').toLowerCase().includes(normalizedSearch)
    ));
  }, [endpoints, normalizedSearch]);

  useEffect(() => {
    if (!activeEndpoint && filteredEndpoints.length) {
      setActiveEndpoint(filteredEndpoints[0]);
    }
  }, [activeEndpoint, filteredEndpoints, setActiveEndpoint]);

  const pathParams = useMemo(() => extractPathParams(activeEndpoint?.path), [activeEndpoint?.path]);
  const queryParams = useMemo(() => (
    activeEndpoint?.parameters?.filter(parameter => parameter.location === 'query') || []
  ), [activeEndpoint]);
  const headerParams = useMemo(() => (
    activeEndpoint?.parameters?.filter(parameter => parameter.location === 'header') || []
  ), [activeEndpoint]);

  useEffect(() => {
    if (!activeEndpoint) return;

    setPathValues(current => {
      const nextPathValues = {};
      pathParams.forEach(name => {
        nextPathValues[name] = current[name] || `sample-${name}`;
      });
      return nextPathValues;
    });

    setQueryValues(current => {
      const nextQueryValues = {};
      queryParams.forEach(parameter => {
        nextQueryValues[parameter.name] = current[parameter.name] || '';
      });
      return nextQueryValues;
    });

    setHeaderValues(current => {
      const nextHeaderValues = {};
      headerParams.forEach(parameter => {
        nextHeaderValues[parameter.name] = current[parameter.name] || '';
      });
      return nextHeaderValues;
    });

    setBody(defaultBody(activeEndpoint));
    setResponse(null);
    setError('');
  }, [activeEndpoint, headerParams, pathParams, queryParams]);

  const resolvedPath = activeEndpoint ? resolvePath(activeEndpoint.path, pathValues) : '';
  const queryString = buildQuery(queryValues);
  const requestPath = activeProject && activeEndpoint
    ? `/mock/${activeProject.id}${resolvedPath}${queryString}`
    : '';
  const requestUrl = `${MOCK_BASE_URL}${requestPath}`;

  const curlPreview = activeEndpoint ? [
    `curl -X ${activeEndpoint.method} \\`,
    `  "${requestUrl}" \\`,
    '  -H "Authorization: Bearer <your-session-token>"',
    ...Object.entries(headerValues).filter(([, value]) => value).map(([key, value]) => `  -H "${key}: ${value}"`),
    body && BODY_METHODS.has(activeEndpoint.method)
      ? `  -H "Content-Type: application/json" \\\n  -d '${body.replace(/\n/g, '')}'`
      : '',
  ].filter(Boolean).join('\n') : '';

  async function handleSend() {
    if (!activeProject || !activeEndpoint) return;
    setSending(true);
    setError('');
    setResponse(null);

    try {
      const headers = Object.fromEntries(Object.entries(headerValues).filter(([, value]) => value));
      const requestBody = BODY_METHODS.has(activeEndpoint.method) && body.trim()
        ? body
        : undefined;
      const contentHeaders = requestBody ? { 'Content-Type': 'application/json', ...headers } : headers;
      const result = await api.testMockEndpoint(requestPath, {
        method: activeEndpoint.method,
        headers: contentHeaders,
        body: requestBody,
      });
      setResponse(result);
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setSending(false);
    }
  }

  async function handleReloadMock() {
    if (!activeProject?.id) return;
    await api.reloadMock(activeProject.id);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar
          searchPlaceholder="Search endpoints..."
          tabs={[
            { label: 'Endpoints', path: '/editor' },
            { label: 'Tester', path: '/tester' },
            { label: 'Monitoring', path: '/monitoring' },
            { label: 'Documentation', path: '/docs' },
          ]}
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: 270, background: '#080808', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ fontSize: 10, color: '#505050', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Testable Endpoints</div>
            </div>
            <div style={{ flex: 1, overflow: 'auto', padding: 6 }}>
              {filteredEndpoints.length === 0 && (
                <div style={{ color: '#606060', fontSize: 12, lineHeight: 1.6, padding: 10 }}>
                  No endpoints available. Create endpoints first, then test them here.
                </div>
              )}
              {filteredEndpoints.map(endpoint => (
                <button
                  key={endpoint.id}
                  onClick={() => setActiveEndpoint(endpoint)}
                  style={{
                    width: '100%',
                    background: activeEndpoint?.id === endpoint.id ? '#111' : 'transparent',
                    border: 'none',
                    borderLeft: activeEndpoint?.id === endpoint.id ? '2px solid #00d4aa' : '2px solid transparent',
                    borderRadius: 6,
                    padding: '9px 10px',
                    marginBottom: 4,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span className={`method-badge ${endpoint.method}`}>{endpoint.method}</span>
                    <span style={{ fontSize: 10, color: '#404040' }}>{endpoint.group_name || 'Default'}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', color: '#b0b0b0', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{endpoint.path}</div>
                  <div style={{ color: '#505050', fontSize: 10, marginTop: 3 }}>{endpoint.summary || 'No summary'}</div>
                </button>
              ))}
            </div>
          </div>

          <main style={{ flex: 1, overflow: 'auto', padding: '22px 26px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
              <div>
                <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.3px', marginBottom: 5 }}>API Tester</h1>
                <p style={{ fontSize: 12, color: '#505050' }}>
                  Send saved endpoints to the live mock server from inside the website.
                </p>
              </div>
              <button onClick={handleReloadMock} disabled={!activeProject} style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 6, padding: '8px 14px', fontSize: 11, color: activeProject ? '#a0a0a0' : '#505050' }}>
                Reload Mock Routes
              </button>
            </div>

            {!activeProject && (
              <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: 18, color: '#606060', fontSize: 12 }}>
                Select a project from the dashboard before testing endpoints.
              </div>
            )}

            {activeProject && activeEndpoint && (
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16 }}>
                <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr auto', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid #1a1a1a' }}>
                      <span className={`method-badge ${activeEndpoint.method}`}>{activeEndpoint.method}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: '#d0d0d0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{requestUrl}</span>
                      <button onClick={handleSend} disabled={sending} style={{ background: '#00d4aa', color: '#000', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, opacity: sending ? 0.7 : 1 }}>
                        {sending ? 'Sending...' : 'Send'}
                      </button>
                    </div>

                    <div style={{ padding: 14, display: 'grid', gap: 14 }}>
                      {pathParams.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                          {pathParams.map(name => (
                            <TesterField
                              key={name}
                              label={`Path: ${name}`}
                              value={pathValues[name] || ''}
                              onChange={value => setPathValues(current => ({ ...current, [name]: value }))}
                              placeholder={`sample-${name}`}
                            />
                          ))}
                        </div>
                      )}

                      {queryParams.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                          {queryParams.map(parameter => (
                            <TesterField
                              key={parameter.id}
                              label={`Query: ${parameter.name}`}
                              value={queryValues[parameter.name] || ''}
                              onChange={value => setQueryValues(current => ({ ...current, [parameter.name]: value }))}
                              placeholder={parameter.required ? 'required' : 'optional'}
                            />
                          ))}
                        </div>
                      )}

                      {headerParams.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                          {headerParams.map(parameter => (
                            <TesterField
                              key={parameter.id}
                              label={`Header: ${parameter.name}`}
                              value={headerValues[parameter.name] || ''}
                              onChange={value => setHeaderValues(current => ({ ...current, [parameter.name]: value }))}
                              placeholder={parameter.required ? 'required' : 'optional'}
                            />
                          ))}
                        </div>
                      )}

                      {BODY_METHODS.has(activeEndpoint.method) && (
                        <label style={{ display: 'grid', gap: 5 }}>
                          <span style={{ fontSize: 10, color: '#505050', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>JSON Body</span>
                          <textarea
                            value={body}
                            onChange={event => setBody(event.target.value)}
                            rows={9}
                            spellCheck={false}
                            style={{ background: '#111', border: '1px solid #242424', borderRadius: 6, color: '#f0f0f0', padding: '10px 12px', fontSize: 12, outline: 'none', resize: 'vertical', fontFamily: 'var(--mono)', lineHeight: 1.65 }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11, color: '#505050', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Response</span>
                      {response && (
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: response.ok ? '#00d4aa' : '#ff5c6a' }}>
                          {response.status} {response.statusText || ''} · {response.durationMs}ms
                        </span>
                      )}
                    </div>
                    <div style={{ padding: 14 }}>
                      {error && <div style={{ color: '#ff5c6a', fontSize: 12 }}>{error}</div>}
                      {!error && !response && <div style={{ color: '#606060', fontSize: 12 }}>Send a request to inspect the mock response here.</div>}
                      {response && (
                        <pre style={{ margin: 0, color: '#b0b0b0', fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                          {formatJson(response.body)}
                        </pre>
                      )}
                    </div>
                  </div>
                </section>

                <aside style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 12, color: '#a0a0a0', fontWeight: 600, marginBottom: 8 }}>Selected Operation</div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                      <span className={`method-badge ${activeEndpoint.method}`}>{activeEndpoint.method}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#d0d0d0' }}>{activeEndpoint.path}</span>
                    </div>
                    <div style={{ color: '#606060', fontSize: 11, lineHeight: 1.6 }}>{activeEndpoint.description || activeEndpoint.summary || 'No endpoint description yet.'}</div>
                  </div>

                  <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 12, color: '#a0a0a0', fontWeight: 600, marginBottom: 8 }}>Curl Preview</div>
                    <pre style={{ margin: 0, color: '#606060', fontFamily: 'var(--mono)', fontSize: 10, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{curlPreview}</pre>
                  </div>

                  {response && (
                    <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: 14 }}>
                      <div style={{ fontSize: 12, color: '#a0a0a0', fontWeight: 600, marginBottom: 8 }}>Response Headers</div>
                      <pre style={{ margin: 0, color: '#606060', fontFamily: 'var(--mono)', fontSize: 10, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{formatJson(response.headers)}</pre>
                    </div>
                  )}
                </aside>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
