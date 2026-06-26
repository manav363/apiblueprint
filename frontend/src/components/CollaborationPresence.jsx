import React from "react";

// Avatar palette — deterministic per name so a person keeps the same colour.
const COLORS = ["#00d4aa", "#60a5fa", "#f5c842", "#ff8a5c", "#c084fc", "#34d399"];

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

function initials(name) {
  return (name || "?")
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * @param {{ collaborators: Array<{clientId: string, name: string}>, status: string }} props
 */
export default function CollaborationPresence({ collaborators = [], status = "idle" }) {
  if (status !== "connected" || collaborators.length === 0) return null;

  const others = collaborators.length - 1;
  const label = others <= 0 ? "Only you" : `${others} other${others === 1 ? "" : "s"} editing`;

  return (
    <div
      role="status"
      aria-label={`${collaborators.length} collaborators connected`}
      style={{ display: "flex", alignItems: "center", gap: 8 }}
    >
      <div style={{ display: "flex" }}>
        {collaborators.slice(0, 4).map((user, index) => (
          <span
            key={user.clientId}
            title={user.name}
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: colorFor(user.name),
              color: "#000",
              fontSize: 9,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid #000",
              marginLeft: index === 0 ? 0 : -7,
            }}
          >
            {initials(user.name)}
          </span>
        ))}
      </div>
      <span style={{ fontSize: 10, color: "#707070" }}>{label}</span>
    </div>
  );
}
