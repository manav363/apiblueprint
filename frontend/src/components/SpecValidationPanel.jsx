import React from "react";

/**
 * Presentational panel for OpenAPI validation results.
 *
 * @param {{ status: 'idle'|'checking'|'done', result: { valid: boolean, errors: Array<{path: string, message: string}> } | null, error: string | null }} props
 */
export default function SpecValidationPanel({ status, result, error }) {
  if (status === "idle" && !result && !error) return null;

  if (status === "checking") {
    return (
      <div role="status" style={panelStyle("#1a1a1a")}>
        <span style={{ fontSize: 11, color: "#a0a0a0" }}>Validating spec…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" style={panelStyle("#ff5c6a")}>
        <span style={{ fontSize: 11, color: "#ff5c6a" }}>Could not validate: {error}</span>
      </div>
    );
  }

  if (result?.valid) {
    return (
      <div role="status" style={panelStyle("#00d4aa")}>
        <span style={{ fontSize: 11, color: "#00d4aa", fontWeight: 600 }}>
          Spec is valid OpenAPI
        </span>
      </div>
    );
  }

  const errors = result?.errors ?? [];
  return (
    <div role="alert" style={panelStyle("#ff5c6a")}>
      <div style={{ fontSize: 11, color: "#ff5c6a", fontWeight: 600, marginBottom: 8 }}>
        {errors.length} validation {errors.length === 1 ? "error" : "errors"}
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
        {errors.map((issue, index) => (
          <li
            key={`${issue.path}-${index}`}
            style={{ fontFamily: "var(--mono)", fontSize: 10, lineHeight: 1.6 }}
          >
            <span style={{ color: "#f5c842" }}>{issue.path}</span>
            <span style={{ color: "#707070" }}> — {issue.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function panelStyle(accent) {
  return {
    background: "#0d0d0d",
    border: `1px solid ${accent}33`,
    borderLeft: `2px solid ${accent}`,
    borderRadius: 6,
    padding: "10px 12px",
    marginTop: 12,
  };
}
