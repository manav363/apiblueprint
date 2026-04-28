import { useEffect, useMemo, useState } from 'react';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';

const STATUS_COLORS = {
  '2xx': '#00d4aa',
  '3xx': '#f5c842',
  '4xx': '#ff8a3d',
  '5xx': '#ff5c6a',
};

function statusColor(statusCode) {
  if (statusCode < 300) return STATUS_COLORS['2xx'];
  if (statusCode < 400) return STATUS_COLORS['3xx'];
  if (statusCode < 500) return STATUS_COLORS['4xx'];
  return STATUS_COLORS['5xx'];
}

function buildLatencyChart(logs) {
  return logs.slice(0, 12).reverse().map(log => ({
    label: log.time,
    latency: Math.min(parseInt(log.latency, 10) || 0, 60),
    status: log.status,
  }));
}

function formatTimestamp(value) {
  if (!value) return 'No activity yet';
  return new Date(value).toLocaleString();
}

function MetricCard({ label, value, hint, accent }) {
  return (
    <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#505050', marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 600, fontFamily: 'var(--mono)', color: '#f0f0f0', marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 11, color: accent }}>{hint}</div>
    </div>
  );
}

export default function Monitoring() {
  const { activeProject } = useApp();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [reloading, setReloading] = useState(false);
  const [lastSync, setLastSync] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function loadMonitoring() {
      if (!activeProject?.id) {
        if (!cancelled) {
          setLogs([]);
          setStats(null);
          setError('');
        }
        return;
      }

      try {
        const [nextLogs, nextStats] = await Promise.all([
          api.getMockLogs(activeProject.id),
          api.getMockStats(activeProject.id),
        ]);

        if (!cancelled) {
          setLogs(nextLogs);
          setStats(nextStats);
          setError('');
          setLastSync(new Date());
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError.message);
        }
      }
    }

    loadMonitoring();
    const timer = window.setInterval(loadMonitoring, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeProject?.id]);

  const chartData = useMemo(() => buildLatencyChart(logs), [logs]);
  const methodEntries = Object.entries(stats?.methods || {});
  const topRoutes = stats?.top_routes || [];
  const metricCards = [
    {
      label: 'Total Requests',
      value: stats?.total_requests ?? 0,
      hint: activeProject ? `traffic for project ${activeProject.id}` : 'select a project',
      accent: '#00d4aa',
    },
    {
      label: 'Average Latency',
      value: stats?.avg_latency || '0ms',
      hint: lastSync ? `refreshed ${lastSync.toLocaleTimeString()}` : 'waiting for samples',
      accent: '#60a5fa',
    },
    {
      label: 'Error Rate',
      value: stats?.error_rate || '0%',
      hint: `${stats?.error_count ?? 0} failing responses`,
      accent: '#ff5c6a',
    },
    {
      label: 'Active Routes',
      value: stats?.path_groups ?? 0,
      hint: stats?.last_reload_at ? `last reload ${new Date(stats.last_reload_at).toLocaleTimeString()}` : 'reload pending',
      accent: '#f5c842',
    },
  ];

  async function handleReload() {
    if (!activeProject?.id) return;

    setReloading(true);
    try {
      await api.reloadMock(activeProject.id);
      const [nextLogs, nextStats] = await Promise.all([
        api.getMockLogs(activeProject.id),
        api.getMockStats(activeProject.id),
      ]);
      setLogs(nextLogs);
      setStats(nextStats);
      setError('');
      setLastSync(new Date());
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
        <Topbar tabs={[
          { label: 'Endpoints', path: '/editor' },
          { label: 'Monitoring', path: '/monitoring' },
          { label: 'Documentation', path: '/docs' },
        ]} />

        <main style={{ flex: 1, overflow: 'auto', padding: '24px 28px' }}>
          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.3px', marginBottom: 4 }}>Monitoring</h1>
              <p style={{ fontSize: 12, color: '#505050' }}>
                Project-scoped mock traffic, route visibility, and reload state
                {activeProject ? ` for ${activeProject.name}` : '.'}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ padding: '8px 12px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 8 }}>
                <div style={{ fontSize: 10, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>Last Request</div>
                <div style={{ fontSize: 11, color: '#b0b0b0' }}>{formatTimestamp(stats?.last_request_at)}</div>
              </div>
              <button
                onClick={handleReload}
                disabled={!activeProject || reloading}
                style={{
                  background: 'transparent',
                  border: '1px solid #242424',
                  borderRadius: 6,
                  padding: '8px 14px',
                  fontSize: 11,
                  color: activeProject ? '#a0a0a0' : '#505050',
                  cursor: activeProject ? 'pointer' : 'default',
                }}
              >
                {reloading ? 'Reloading...' : 'Reload Mock Routes'}
              </button>
            </div>
          </div>

          {!activeProject && (
            <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, padding: 16, color: '#606060', fontSize: 12 }}>
              Select a project from the sidebar to inspect mock traffic and reload state.
            </div>
          )}

          {error && <div style={{ color: '#ff5c6a', fontSize: 12, marginBottom: 12, whiteSpace: 'pre-wrap' }}>{error}</div>}

          {activeProject && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                {metricCards.map(card => (
                  <MetricCard
                    key={card.label}
                    label={card.label}
                    value={card.value}
                    hint={card.hint}
                    accent={card.accent}
                  />
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: 16, marginBottom: 16 }}>
                <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, padding: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#a0a0a0' }}>Latency Timeline</span>
                    <span style={{ fontSize: 10, color: '#404040' }}>{chartData.length} recent samples</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 140 }}>
                    {chartData.map((point, index) => (
                      <div key={`${point.label}-${index}`} style={{ flex: 1 }}>
                        <div
                          title={`${point.label} · ${point.latency}ms`}
                          style={{
                            width: '100%',
                            height: `${Math.max(12, point.latency * 2)}%`,
                            background: `${statusColor(point.status)}33`,
                            border: `1px solid ${statusColor(point.status)}55`,
                            borderRadius: '4px 4px 0 0',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                    <span style={{ fontSize: 10, color: '#303030' }}>{chartData[0]?.label || '--:--:--'}</span>
                    <span style={{ fontSize: 10, color: '#303030' }}>{chartData[chartData.length - 1]?.label || '--:--:--'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, padding: '16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#a0a0a0', marginBottom: 12 }}>Status Buckets</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                      {Object.entries(stats?.status_buckets || {}).map(([bucket, count]) => (
                        <div key={bucket} style={{ background: '#080808', border: '1px solid #151515', borderRadius: 8, padding: '10px 12px' }}>
                          <div style={{ fontFamily: 'var(--mono)', fontSize: 18, color: '#f0f0f0', marginBottom: 4 }}>{count}</div>
                          <div style={{ fontSize: 10, color: STATUS_COLORS[bucket], letterSpacing: '0.08em', textTransform: 'uppercase' }}>{bucket}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, padding: '16px' }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#a0a0a0', marginBottom: 12 }}>Method Mix</div>
                    {methodEntries.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#606060' }}>No request mix yet.</div>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {methodEntries.map(([method, count]) => (
                          <div key={method} style={{ background: '#080808', border: '1px solid #151515', borderRadius: 999, padding: '6px 10px' }}>
                            <span className={`method-badge ${method}`}>{method}</span>
                            <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontSize: 11, color: '#909090' }}>{count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.8fr) minmax(0, 1.2fr)', gap: 16, marginBottom: 16 }}>
                <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#a0a0a0' }}>Hot Routes</span>
                    <span style={{ fontSize: 10, color: '#404040' }}>{stats?.registered_projects?.length || 0} projects cached</span>
                  </div>
                  <div style={{ padding: 12 }}>
                    {topRoutes.length === 0 ? (
                      <div style={{ fontSize: 12, color: '#606060' }}>No requests yet. Generated traffic will surface here.</div>
                    ) : (
                      topRoutes.map(route => (
                        <div key={route.route} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', background: '#080808', border: '1px solid #151515', borderRadius: 8, marginBottom: 8 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#b0b0b0' }}>{route.route}</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#00d4aa' }}>{route.count}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 10, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#a0a0a0' }}>Request Log</span>
                    <span style={{ fontSize: 11, color: '#00d4aa' }}>{logs.length} recent requests</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #141414' }}>
                        {['Time', 'Method', 'Route', 'Status', 'Latency'].map(header => (
                          <th key={header} style={{ padding: '8px 16px', fontSize: 10, color: '#404040', textAlign: 'left', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {logs.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: '16px', color: '#606060', fontSize: 12 }}>
                            No mock traffic yet. Hit a generated mock endpoint and the log will populate here.
                          </td>
                        </tr>
                      )}
                      {logs.map((log, index) => (
                        <tr key={`${log.timestamp || log.time}-${index}`} style={{ borderBottom: '1px solid #111' }}>
                          <td style={{ padding: '9px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: '#404040' }}>{log.time}</td>
                          <td style={{ padding: '9px 16px' }}><span className={`method-badge ${log.method}`}>{log.method}</span></td>
                          <td style={{ padding: '9px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: '#808080' }}>{log.route_template || log.path}</td>
                          <td style={{ padding: '9px 16px', fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600, color: statusColor(log.status) }}>{log.status}</td>
                          <td style={{ padding: '9px 16px', fontFamily: 'var(--mono)', fontSize: 11, color: '#505050' }}>{log.latency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
