// Client for the mock server's collaboration WebSocket (/collab). It exposes a
// tiny imperative handle the app uses to broadcast local edits and to react to
// presence + remote-edit events. The WebSocket implementation is injectable so
// it can be unit-tested without a real socket.
import { MOCK_BASE_URL } from "./api";

function toWebSocketUrl(httpUrl) {
  return httpUrl.replace(/^http/, "ws");
}

export function buildCollabUrl({ projectId, token, name }) {
  const params = new URLSearchParams({
    projectId: String(projectId),
    token: token || "",
    name: name || "Anonymous",
  });
  return `${toWebSocketUrl(MOCK_BASE_URL)}/collab?${params.toString()}`;
}

export function createCollabConnection({
  projectId,
  token,
  name,
  onPresence,
  onEdit,
  onStatus,
  WebSocketImpl,
}) {
  const WS = WebSocketImpl || (typeof window !== "undefined" ? window.WebSocket : undefined);
  if (!WS) {
    throw new Error("No WebSocket implementation available");
  }

  const socket = new WS(buildCollabUrl({ projectId, token, name }));

  socket.addEventListener("open", () => onStatus?.("connected"));
  socket.addEventListener("close", () => onStatus?.("disconnected"));
  socket.addEventListener("error", () => onStatus?.("error"));
  socket.addEventListener("message", (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }
    if (message.type === "presence") onPresence?.(message);
    else if (message.type === "edit") onEdit?.(message);
  });

  return {
    sendEdit(payload = {}) {
      if (socket.readyState === 1 /* OPEN */) {
        socket.send(JSON.stringify({ type: "edit", ...payload }));
      }
    },
    close() {
      socket.close();
    },
    socket,
  };
}
