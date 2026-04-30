import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useApp } from '../context/AppContext';

const statusColor = (statusCode) => {
  const code = parseInt(statusCode, 10);
  if (code < 300) return '#00d4aa';
  if (code < 400) return '#f5c842';
  return '#ff5c6a';
};

export default function Documentation() {
  const { activeProject, endpoints, activeEndpoint, setActiveEndpoint, searchQuery, setSearchQuery } = useApp();

  const filteredEndpoints = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    if (!normalized) return endpoints;
    return endpoints.filter(endpoint => (
      endpoint.path.toLowerCase().includes(normalized)
      || endpoint.method.toLowerCase().includes(normalized)
      || (endpoint.summary || '').toLowerCase().includes(normalized)
      || (endpoint.tag || '').toLowerCase().includes(normalized)
    ));
  }, [endpoints, searchQuery]);

  useEffect(() => {
    if (!filteredEndpoints.length) {
      if (activeEndpoint) setActiveEndpoint(null);
      return;
    }
    if (!activeEndpoint || !filteredEndpoints.find(endpoint => endpoint.id === activeEndpoint.id)) {
      setActiveEndpoint(filteredEndpoints[0]);
    }
  }, [filteredEndpoints, activeEndpoint, setActiveEndpoint]);

  const activeDoc = filteredEndpoints.find(endpoint => endpoint.id === activeEndpoint?.id) || filteredEndpoints[0] || null;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar
          searchPlaceholder="Search endpoints..."
          tabs={[
          { label: 'Endpoints', path: '/editor' },
          { label: 'Monitoring', path: '/monitoring' },
          { label: 'Documentation', path: '/docs' },
        ]}
        />

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ width: 260, background: '#080808', borderRight: '1px solid #1a1a1a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #1a1a1a' }}>
              <div style={{ fontSize: 12, color: '#d0d0d0', marginBottom: 8, fontWeight: 600 }}>{activeProject?.name || 'API Documentation'}</div>
              <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 6, padding: '6px 10px', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ color: '#404040', fontSize: 12 }}>⌕</span>
                <input
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                  placeholder="Search endpoints..."
                  style={{ background: 'transparent', border: 'none', color: '#808080', fontSize: 11, outline: 'none', width: '100%' }}
                />
              </div>
            </div>

            <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
              {filteredEndpoints.length === 0 && (
                <div style={{ color: '#606060', fontSize: 12, padding: 8 }}>
                  No endpoints match your search yet.
                </div>
              )}
              {filteredEndpoints.map(endpoint => (
                <div
                  key={endpoint.id}
                  onClick={() => setActiveEndpoint(endpoint)}
                  style={{
                    padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 2,
                    background: activeDoc?.id === endpoint.id ? '#111' : 'transparent',
                    borderLeft: activeDoc?.id === endpoint.id ? '2px solid #00d4aa' : '2px solid transparent',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span className={`method-badge ${endpoint.method}`}>{endpoint.method}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#808080' }}>{endpoint.path}</div>
                  <div style={{ fontSize: 10, color: '#404040', marginTop: 2 }}>{endpoint.summary || 'No summary yet'}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '24px 32px' }}>
            {!activeDoc && (
              <div style={{ color: '#606060', fontSize: 13 }}>
                Add an endpoint from the editor to generate documentation here.
              </div>
            )}

            {activeDoc && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <span className={`method-badge ${activeDoc.method}`} style={{ fontSize: 11, padding: '4px 10px' }}>{activeDoc.method}</span>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 16, color: '#d0d0d0' }}>{activeDoc.path}</span>
                </div>

                <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10, letterSpacing: '-0.3px' }}>{activeDoc.summary || 'Untitled operation'}</h2>
                <p style={{ fontSize: 13, color: '#707070', lineHeight: 1.7, marginBottom: 28, maxWidth: 700 }}>
                  {activeDoc.description || 'No description provided yet.'}
                </p>

                <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                  <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: '#404040', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Group</div>
                    <div style={{ fontSize: 12, color: '#d0d0d0' }}>{activeDoc.group_name || 'Default'}</div>
                  </div>
                  <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 10, color: '#404040', marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Operation ID</div>
                    <div style={{ fontSize: 12, color: '#d0d0d0', fontFamily: 'var(--mono)' }}>{activeDoc.operation_id || 'Generated automatically'}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#505050', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Parameters</div>
                  {activeDoc.parameters.length === 0 ? (
                    <div style={{ color: '#606060', fontSize: 12 }}>No parameters configured.</div>
                  ) : (
                    <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #1a1a1a' }}>
                            {['Name', 'In', 'Type', 'Required', 'Description'].map(header => (
                              <th key={header} style={{ padding: '8px 14px', fontSize: 10, color: '#404040', textAlign: 'left', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {activeDoc.parameters.map(parameter => (
                            <tr key={parameter.id}>
                              <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 12, color: '#60a5fa' }}>{parameter.name}</td>
                              <td style={{ padding: '10px 14px', fontSize: 11, color: '#606060' }}>{parameter.location}</td>
                              <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: 11, color: '#a8ff9a' }}>{parameter.type}</td>
                              <td style={{ padding: '10px 14px', fontSize: 11, color: parameter.required ? '#f5c842' : '#60a5fa' }}>
                                {parameter.required ? 'required' : 'optional'}
                              </td>
                              <td style={{ padding: '10px 14px', fontSize: 12, color: '#606060' }}>{parameter.description || 'No description'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#505050', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Example Request</div>
                  <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ background: '#0d0d0d', borderBottom: '1px solid #1a1a1a', padding: '6px 14px', display: 'flex', gap: 6 }}>
                      {[...Array(3)].map((_, index) => <div key={index} style={{ width: 8, height: 8, borderRadius: '50%', background: ['#ff5c6a', '#f5c842', '#00d4aa'][index] }} />)}
                    </div>
                    <pre style={{ padding: '14px 16px', fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.8, color: '#606060', margin: 0 }}>
                      <span style={{ color: '#f5c842' }}>curl</span>{' '}
                      <span style={{ color: '#a8ff9a' }}>-X {activeDoc.method}</span>{' \\'}
                      {'\n  '}
                      <span style={{ color: '#a8ff9a' }}>"http://localhost:4010/mock/{activeProject?.id || 'project'}{activeDoc.path.replace(/\{(\w+)\}/g, 'sample')}"</span>
                    </pre>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#505050', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>Responses</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {activeDoc.responses.length === 0 && (
                      <div style={{ color: '#606060', fontSize: 12 }}>No responses configured.</div>
                    )}
                    {activeDoc.responses.map(response => (
                      <div key={response.id} style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, fontSize: 14, color: statusColor(response.status_code), minWidth: 36 }}>{response.status_code}</span>
                          <span style={{ fontSize: 12, color: '#707070' }}>{response.description || 'No description'}</span>
                        </div>
                        <pre style={{ margin: 0, fontFamily: 'var(--mono)', fontSize: 11, lineHeight: 1.7, color: '#505050', whiteSpace: 'pre-wrap' }}>
                          {response.example || '{}'}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
