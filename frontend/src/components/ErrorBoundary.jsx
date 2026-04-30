import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#050505',
        padding: 32,
      }}>
        <div style={{
          maxWidth: 480,
          width: '100%',
          background: 'rgba(13,13,13,0.96)',
          border: '1px solid #1c1c1c',
          borderRadius: 16,
          padding: 32,
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
          textAlign: 'center',
        }}>
          <div style={{
            width: 56,
            height: 56,
            borderRadius: 14,
            background: 'rgba(255,92,106,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            margin: '0 auto 18px',
          }}>
            ⚠️
          </div>

          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: '#f0f0f0' }}>
            Something went wrong
          </h2>
          <p style={{ fontSize: 13, color: '#707070', lineHeight: 1.7, marginBottom: 20 }}>
            An unexpected error occurred. You can try again or reload the page.
          </p>

          {this.state.error && (
            <pre style={{
              background: '#111',
              border: '1px solid #242424',
              borderRadius: 8,
              padding: '12px 14px',
              fontSize: 11,
              fontFamily: "'IBM Plex Mono', monospace",
              color: '#ff5c6a',
              textAlign: 'left',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 120,
              overflow: 'auto',
              marginBottom: 20,
            }}>
              {this.state.error.message || String(this.state.error)}
            </pre>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={this.handleReset}
              style={{
                background: '#00d4aa',
                color: '#000',
                border: 'none',
                borderRadius: 8,
                padding: '10px 22px',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: 'transparent',
                color: '#a0a0a0',
                border: '1px solid #242424',
                borderRadius: 8,
                padding: '10px 22px',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
