import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useApp } from '../context/AppContext';
import { api, MOCK_BASE_URL } from '../services/api';

function getPathParams(endpoint) {
  return Array.from(endpoint.path.matchAll(/\{(\w+)\}/g), match => match[1]);
}

function getQueryParams(endpoint) {
  return endpoint.parameters
    .filter(parameter => parameter.location === 'query')
    .map(parameter => parameter.name);
}

function acceptsBody(endpoint) {
  return !['GET', 'DELETE'].includes(endpoint.method.toUpperCase());
}

function toMethodName(endpoint) {
  const parts = endpoint.path
    .replace(/^\//, '')
    .replace(/\{(\w+)\}/g, 'by-$1')
    .split('/')
    .filter(Boolean);
  const base = [endpoint.method.toLowerCase(), ...parts].join('-');
  return base.replace(/-([a-z])/g, (_, char) => char.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '') || 'callRoot';
}

function buildPythonPath(endpoint) {
  return endpoint.path.replace(/\{(\w+)\}/g, '${$1}');
}

function buildTypeScriptPath(endpoint) {
  return endpoint.path.replace(/\{(\w+)\}/g, '${$1}');
}

function buildPythonSdk(endpoints, projectId) {
  const lines = [
    'import requests',
    '',
    'class APIBlueprintClient:',
    `    def __init__(self, base_url="${MOCK_BASE_URL}/mock/${projectId}", headers=None):`,
    '        self.base_url = base_url.rstrip("/")',
    '        self.headers = headers or {}',
    '        self.session = requests.Session()',
    '',
  ];

  endpoints.forEach(endpoint => {
    const pathParams = getPathParams(endpoint);
    const queryParams = getQueryParams(endpoint);
    const args = [...pathParams];

    if (queryParams.length > 0) args.push('query=None');
    if (acceptsBody(endpoint)) args.push('payload=None');

    lines.push(`    def ${toMethodName(endpoint)}(self${args.length ? `, ${args.join(', ')}` : ''}):`);
    lines.push(`        url = f"{self.base_url}${buildPythonPath(endpoint)}"`);
    if (queryParams.length > 0) {
      lines.push('        query = query or {}');
    }
    const requestArgs = [
      'url',
      'headers=self.headers',
      queryParams.length > 0 ? 'params=query' : null,
      acceptsBody(endpoint) ? 'json=payload' : null,
    ].filter(Boolean);
    lines.push(`        response = self.session.${endpoint.method.toLowerCase()}(${requestArgs.join(', ')})`);
    lines.push('        response.raise_for_status()');
    lines.push('        return response.json()');
    lines.push('');
  });

  return lines.join('\n');
}

function buildTypeScriptSdk(endpoints, projectId) {
  const lines = [
    `export class APIBlueprintClient {`,
    `  constructor(baseUrl = "${MOCK_BASE_URL}/mock/${projectId}", headers = {}) {`,
    '    this.baseUrl = baseUrl.replace(/\\/$/, "");',
    '    this.headers = headers;',
    '  }',
    '',
  ];

  endpoints.forEach(endpoint => {
    const pathParams = getPathParams(endpoint);
    const queryParams = getQueryParams(endpoint);
    const args = [...pathParams];

    if (queryParams.length > 0) args.push('query = {}');
    if (acceptsBody(endpoint)) args.push('payload = null');

    lines.push(`  async ${toMethodName(endpoint)}(${args.join(', ')}) {`);
    lines.push(`    const url = new URL(\`${'${this.baseUrl}'}${buildTypeScriptPath(endpoint)}\`);`);
    if (queryParams.length > 0) {
      lines.push('    Object.entries(query).forEach(([key, value]) => {');
      lines.push('      if (value !== undefined && value !== null) {');
      lines.push('        url.searchParams.set(key, String(value));');
      lines.push('      }');
      lines.push('    });');
    }
    lines.push('    const response = await fetch(url.toString(), {');
    lines.push(`      method: "${endpoint.method.toUpperCase()}",`);
    lines.push('      headers: { ...this.headers, "Content-Type": "application/json" },');
    if (acceptsBody(endpoint)) {
      lines.push('      body: payload ? JSON.stringify(payload) : undefined,');
    }
    lines.push('    });');
    lines.push('    if (!response.ok) throw new Error(`HTTP ${response.status}`);');
    lines.push('    return response.json();');
    lines.push('  }');
    lines.push('');
  });

  lines.push('}');
  return lines.join('\n');
}

function formatTimestamp(value) {
  if (!value) return 'No traffic yet';
  return new Date(value).toLocaleString();
}

function ProjectMetric({ label, value, hint }) {
  return (
    <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: '#404040', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 18, fontWeight: 600, color: '#f0f0f0', marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#606060' }}>{hint}</div>
    </div>
  );
}

export default function ExportPage() {
  const { activeProject, endpoints } = useApp();
  const navigate = useNavigate();
  const [sdkLang, setSdkLang] = useState('Python');
  const [copied, setCopied] = useState('');
  const [yamlSpec, setYamlSpec] = useState('');
  const [stats, setStats] = useState(null);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState('');
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadExportData() {
      if (!activeProject?.id) {
        if (!cancelled) {
          setYamlSpec('');
          setStats(null);
          setLogs([]);
          setError('');
        }
        return;
      }

      try {
        const [yaml, mockStats, mockLogs] = await Promise.all([
          api.getSpecYaml(activeProject.id),
          api.getMockStats(activeProject.id),
          api.getMockLogs(activeProject.id),
        ]);

        if (!cancelled) {
          setYamlSpec(yaml);
          setStats(mockStats);
          setLogs(mockLogs);
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
        }
      }
    }

    loadExportData();
    return () => {
      cancelled = true;
    };
  }, [activeProject?.id, endpoints]);

  const sdkPreview = useMemo(() => {
    if (!activeProject?.id) return '';
    return sdkLang === 'Python'
      ? buildPythonSdk(endpoints, activeProject.id)
      : buildTypeScriptSdk(endpoints, activeProject.id);
  }, [sdkLang, endpoints, activeProject?.id]);

  const endpointInventory = useMemo(() => endpoints.map(endpoint => ({
    id: endpoint.id,
    method: endpoint.method.toUpperCase(),
    path: endpoint.path,
    methodName: toMethodName(endpoint),
    queryCount: getQueryParams(endpoint).length,
    pathCount: getPathParams(endpoint).length,
  })), [endpoints]);

  async function copyText(value, type) {
    await navigator.clipboard.writeText(value);
    setCopied(type);
    window.setTimeout(() => setCopied(''), 2000);
  }

  function handleDownload() {
    const blob = new Blob([yamlSpec], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${activeProject?.name || 'apiblueprint'}.yaml`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function handleReloadMock() {
    if (!activeProject?.id) return;

    setReloading(true);
    try {
      await api.reloadMock(activeProject.id);
      const [mockStats, mockLogs] = await Promise.all([
        api.getMockStats(activeProject.id),
        api.getMockLogs(activeProject.id),
      ]);
      setStats(mockStats);
      setLogs(mockLogs);
      setError('');
    } catch (reloadError) {
      setError(reloadError.message);
    } finally {
      setReloading(false);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Export Spec & SDKs</div>
                <div style={{ fontSize: 11, color: '#505050' }}>
                  {activeProject ? `${activeProject.name} · ${activeProject.version}` : 'Select a project to export'}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={() => copyText(yamlSpec, 'yaml')}
                  disabled={!yamlSpec}
                  style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 6, padding: '7px 14px', fontSize: 12, color: copied === 'yaml' ? '#00d4aa' : '#a0a0a0', cursor: 'pointer' }}
                >
                  {copied === 'yaml' ? 'YAML Copied' : 'Copy YAML'}
                </button>
                <button
                  onClick={() => copyText(sdkPreview, 'sdk')}
                  disabled={!sdkPreview}
                  style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 6, padding: '7px 14px', fontSize: 12, color: copied === 'sdk' ? '#00d4aa' : '#a0a0a0', cursor: 'pointer' }}
                >
                  {copied === 'sdk' ? 'SDK Copied' : `Copy ${sdkLang} SDK`}
                </button>
                <button onClick={handleDownload} disabled={!yamlSpec} style={{ background: '#00d4aa', color: '#000', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Download YAML
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
              {error && <div style={{ color: '#ff5c6a', fontSize: 12, marginBottom: 12, whiteSpace: 'pre-wrap' }}>{error}</div>}

              {!activeProject ? (
                <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, padding: 16, color: '#606060', fontSize: 12 }}>
                  Select a project from the sidebar to generate an OpenAPI export and SDK preview.
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
                    <ProjectMetric label="Endpoints" value={endpointInventory.length} hint="methods ready for export" />
                    <ProjectMetric label="YAML Size" value={`${yamlSpec.length} bytes`} hint="generated OpenAPI payload" />
                    <ProjectMetric label="Mock Requests" value={stats?.total_requests ?? 0} hint={formatTimestamp(stats?.last_request_at)} />
                    <ProjectMetric label="Average Latency" value={stats?.avg_latency || '0ms'} hint={stats?.error_rate || '0% error rate'} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.05fr) minmax(320px, 0.95fr)', gap: 16 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 11, color: '#505050', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>OpenAPI Specification</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#404040' }}>{activeProject.version}</span>
                      </div>

                      <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden', marginBottom: 16 }}>
                        <div style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a', padding: '6px 14px', display: 'flex', gap: 6 }}>
                          {[...Array(3)].map((_, index) => <div key={index} style={{ width: 8, height: 8, borderRadius: '50%', background: ['#ff5c6a', '#f5c842', '#00d4aa'][index] }} />)}
                        </div>
                        <pre style={{ padding: '14px 16px', fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.8, overflow: 'auto', margin: 0, color: '#b0b0b0', whiteSpace: 'pre-wrap', maxHeight: 500 }}>
                          {yamlSpec || 'No generated spec yet.'}
                        </pre>
                      </div>

                      <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#a0a0a0' }}>Endpoint Inventory</span>
                          <span style={{ fontSize: 10, color: '#404040' }}>{endpointInventory.length} generated methods</span>
                        </div>
                        <div style={{ padding: 12 }}>
                          {endpointInventory.length === 0 ? (
                            <div style={{ fontSize: 12, color: '#606060' }}>No endpoints available for export yet.</div>
                          ) : (
                            endpointInventory.map(endpoint => (
                              <div key={endpoint.id} style={{ display: 'grid', gridTemplateColumns: '72px minmax(0, 1fr) 140px', gap: 12, alignItems: 'center', background: '#080808', border: '1px solid #151515', borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
                                <span className={`method-badge ${endpoint.method}`}>{endpoint.method}</span>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#b0b0b0' }}>{endpoint.path}</span>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#606060' }}>{endpoint.methodName}()</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div style={{ width: 320, background: '#080808', border: '1px solid #1a1a1a', borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                      <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 12 }}>Generated SDK Preview</div>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                          {['Python', 'TypeScript'].map(language => (
                            <button key={language} onClick={() => setSdkLang(language)} style={{
                              background: sdkLang === language ? '#1a1a1a' : 'transparent',
                              border: `1px solid ${sdkLang === language ? '#2e2e2e' : '#1a1a1a'}`,
                              borderRadius: 5, padding: '4px 10px', fontSize: 11,
                              color: sdkLang === language ? '#f0f0f0' : '#505050', cursor: 'pointer',
                            }}>{language}</button>
                          ))}
                        </div>

                        <div style={{ background: '#000', border: '1px solid #1a1a1a', borderRadius: 6, padding: '10px 12px', maxHeight: 240, overflow: 'auto', marginBottom: 12 }}>
                          <pre style={{ fontFamily: 'var(--mono)', fontSize: 10, lineHeight: 1.7, color: '#8a8a8a', margin: 0, whiteSpace: 'pre-wrap' }}>
                            {sdkPreview || 'No endpoints available to generate a preview yet.'}
                          </pre>
                        </div>
                      </div>

                      <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>Mock Server</span>
                          <span style={{ fontSize: 10, color: '#00d4aa', fontWeight: 600 }}>LIVE</span>
                        </div>

                        <div style={{ background: '#000', border: '1px solid #1a1a1a', borderRadius: 5, padding: '6px 10px', marginBottom: 10 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#00d4aa' }}>
                            {activeProject ? `${MOCK_BASE_URL}/mock/${activeProject.id}` : `${MOCK_BASE_URL}/mock/{projectId}`}
                          </span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                          <ProjectMetric label="Requests" value={stats?.total_requests ?? 0} hint={stats?.last_request_at ? 'recent traffic' : 'idle'} />
                          <ProjectMetric label="Routes" value={stats?.path_groups ?? 0} hint={stats?.last_reload_at ? 'spec loaded' : 'reload pending'} />
                        </div>

                        <button onClick={handleReloadMock} disabled={!activeProject || reloading} style={{ width: '100%', background: 'transparent', border: '1px solid #1e1e1e', borderRadius: 6, padding: '7px', fontSize: 11, color: '#a0a0a0', cursor: 'pointer' }}>
                          {reloading ? 'Reloading Mock...' : 'Reload Mock Routes'}
                        </button>
                      </div>

                      <div style={{ padding: '12px 14px', borderBottom: '1px solid #1a1a1a' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 10 }}>Traffic Visibility</div>
                        <div style={{ fontSize: 11, color: '#606060', marginBottom: 8 }}>Last request: {formatTimestamp(stats?.last_request_at)}</div>
                        <div style={{ fontSize: 11, color: '#606060', marginBottom: 10 }}>Last reload: {formatTimestamp(stats?.last_reload_at)}</div>
                        {(stats?.top_routes || []).slice(0, 3).map(route => (
                          <div key={route.route} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#b0b0b0' }}>{route.route}</span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#00d4aa' }}>{route.count}</span>
                          </div>
                        ))}
                        {logs.length === 0 && <div style={{ fontSize: 11, color: '#505050' }}>No live requests yet for this project.</div>}
                      </div>

                      <div style={{ padding: '12px 14px', flex: 1 }}>
                        <div onClick={() => navigate('/docs')} style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: '10px 12px', cursor: 'pointer' }}>
                          <div style={{ fontSize: 11, color: '#a0a0a0', fontWeight: 600, marginBottom: 3 }}>View Live Docs</div>
                          <div style={{ fontSize: 11, color: '#404040' }}>Inspect the same project data in the documentation view.</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
