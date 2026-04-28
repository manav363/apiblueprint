import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useApp } from '../context/AppContext';
import { api, MOCK_BASE_URL } from '../services/api';

function toMethodName(endpoint) {
  const parts = endpoint.path
    .replace(/^\//, '')
    .replace(/\{(\w+)\}/g, 'by-$1')
    .split('/')
    .filter(Boolean);
  const base = [endpoint.method.toLowerCase(), ...parts].join('-');
  return base.replace(/-([a-z])/g, (_, char) => char.toUpperCase()).replace(/[^a-zA-Z0-9]/g, '');
}

function buildPythonSdk(endpoints, projectId) {
  const lines = [
    'import requests',
    '',
    'class APIBlueprintClient:',
    `    BASE_URL = "${MOCK_BASE_URL}/mock/${projectId}"`,
    '',
    '    def __init__(self, headers=None):',
    '        self.headers = headers or {}',
    '',
  ];

  endpoints.forEach(endpoint => {
    lines.push(`    def ${toMethodName(endpoint)}(self, payload=None):`);
    lines.push(`        return requests.${endpoint.method.toLowerCase()}(`);
    lines.push(`            f"{self.BASE_URL}${endpoint.path.replace(/\{(\w+)\}/g, '{$1}')}",`);
    lines.push('            json=payload,');
    lines.push('            headers=self.headers,');
    lines.push('        ).json()');
    lines.push('');
  });

  return lines.join('\n');
}

function buildTypeScriptSdk(endpoints, projectId) {
  const lines = [
    `const BASE_URL = "${MOCK_BASE_URL}/mock/${projectId}";`,
    '',
    'export class APIBlueprintClient {',
    '  constructor(headers = {}) {',
    '    this.headers = headers;',
    '  }',
    '',
  ];

  endpoints.forEach(endpoint => {
    lines.push(`  async ${toMethodName(endpoint)}(payload = null) {`);
    lines.push(`    const response = await fetch(\`${'${BASE_URL}'}${endpoint.path.replace(/\{(\w+)\}/g, '${$1}')}\`, {`);
    lines.push(`      method: "${endpoint.method}",`);
    lines.push('      headers: { ...this.headers, "Content-Type": "application/json" },');
    lines.push('      body: payload ? JSON.stringify(payload) : undefined,');
    lines.push('    });');
    lines.push('    return response.json();');
    lines.push('  }');
    lines.push('');
  });

  lines.push('}');
  return lines.join('\n');
}

export default function ExportPage() {
  const { activeProject, endpoints } = useApp();
  const navigate = useNavigate();
  const [sdkLang, setSdkLang] = useState('Python');
  const [copied, setCopied] = useState(false);
  const [yamlSpec, setYamlSpec] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadExportData() {
      if (!activeProject?.id) return;
      const [yaml, mockStats] = await Promise.all([
        api.getSpecYaml(activeProject.id),
        api.getMockStats().catch(() => null),
      ]);
      if (!cancelled) {
        setYamlSpec(yaml);
        setStats(mockStats);
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

  async function handleCopy() {
    await navigator.clipboard.writeText(yamlSpec);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
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
    await api.reloadMock(activeProject.id);
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '12px 20px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>Export Spec & SDKs</div>
                <div style={{ fontSize: 11, color: '#505050' }}>
                  {activeProject ? `${activeProject.name} · ${activeProject.version}` : 'Select a project to export'}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button onClick={handleCopy} disabled={!yamlSpec} style={{ background: 'transparent', border: '1px solid #242424', borderRadius: 6, padding: '7px 14px', fontSize: 12, color: copied ? '#00d4aa' : '#a0a0a0', cursor: 'pointer' }}>
                  {copied ? 'Copied' : 'Copy YAML'}
                </button>
                <button onClick={handleDownload} disabled={!yamlSpec} style={{ background: '#00d4aa', color: '#000', border: 'none', borderRadius: 6, padding: '7px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  Download YAML
                </button>
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: '#505050', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>OpenAPI Specification</span>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#404040' }}>{yamlSpec.length} bytes</span>
              </div>

              <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a', padding: '6px 14px', display: 'flex', gap: 6 }}>
                  {[...Array(3)].map((_, index) => <div key={index} style={{ width: 8, height: 8, borderRadius: '50%', background: ['#ff5c6a', '#f5c842', '#00d4aa'][index] }} />)}
                </div>
                <pre style={{ padding: '14px 16px', fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.8, overflow: 'auto', margin: 0, color: '#b0b0b0', whiteSpace: 'pre-wrap' }}>
                  {yamlSpec || 'No generated spec yet.'}
                </pre>
              </div>
            </div>
          </div>

          <div style={{ width: 320, background: '#080808', borderLeft: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column' }}>
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

              <div style={{ background: '#000', border: '1px solid #1a1a1a', borderRadius: 6, padding: '10px 12px', maxHeight: 200, overflow: 'auto', marginBottom: 12 }}>
                <pre style={{ fontFamily: 'var(--mono)', fontSize: 10, lineHeight: 1.7, color: '#707070', margin: 0, whiteSpace: 'pre-wrap' }}>
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
                {[['Requests', stats?.total_requests ?? 0], ['Latency', stats?.avg_latency ?? '0ms']].map(([label, value]) => (
                  <div key={label} style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 6, padding: '8px 10px' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, color: '#f0f0f0' }}>{value}</div>
                    <div style={{ fontSize: 9, color: '#404040', letterSpacing: '0.08em', marginTop: 2 }}>{label.toUpperCase()}</div>
                  </div>
                ))}
              </div>

              <button onClick={handleReloadMock} disabled={!activeProject} style={{ width: '100%', background: 'transparent', border: '1px solid #1e1e1e', borderRadius: 6, padding: '7px', fontSize: 11, color: '#a0a0a0', cursor: 'pointer' }}>
                Reload Mock Routes
              </button>
            </div>

            <div style={{ padding: '12px 14px', flex: 1 }}>
              <div onClick={() => navigate('/docs')} style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: '10px 12px', cursor: 'pointer' }}>
                <div style={{ fontSize: 11, color: '#a0a0a0', fontWeight: 600, marginBottom: 3 }}>View Live Docs</div>
                <div style={{ fontSize: 11, color: '#404040' }}>Inspect the same project data in the documentation view.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
