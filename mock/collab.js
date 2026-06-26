"use strict";

// Real-time collaboration for shared editing sessions.
//
// Clients open a WebSocket to /collab?projectId=<id>&token=<jwt>&name=<who> and
// join a per-project "room". The hub broadcasts presence (who's in the room) and
// relays edit/cursor events to everyone else in the same project, so two people
// editing the same project see each other and each other's changes in real time.

const { WebSocketServer, WebSocket } = require("ws");

const MAX_NAME_LENGTH = 40;
const CLOSE_PROJECT_REQUIRED = 4400;
const CLOSE_AUTH_REQUIRED = 4401;
const RELAYED_TYPES = new Set(["edit", "cursor"]);

class CollaborationHub {
  constructor() {
    this.rooms = new Map(); // projectId -> Set<client>
  }

  join(projectId, client) {
    if (!this.rooms.has(projectId)) this.rooms.set(projectId, new Set());
    this.rooms.get(projectId).add(client);
  }

  leave(projectId, client) {
    const room = this.rooms.get(projectId);
    if (!room) return;
    room.delete(client);
    if (room.size === 0) this.rooms.delete(projectId);
  }

  roster(projectId) {
    const room = this.rooms.get(projectId);
    if (!room) return [];
    return [...room].map((client) => ({ clientId: client.clientId, name: client.userName }));
  }

  broadcast(projectId, message, { except } = {}) {
    const room = this.rooms.get(projectId);
    if (!room) return 0;
    const data = JSON.stringify(message);
    let sent = 0;
    for (const client of room) {
      if (client === except) continue;
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
        sent += 1;
      }
    }
    return sent;
  }
}

function attachCollaboration(server, { verifyToken, hub = new CollaborationHub(), path = "/collab" } = {}) {
  const wss = new WebSocketServer({ server, path });
  let nextClientId = 1;

  function broadcastPresence(projectId) {
    const users = hub.roster(projectId);
    hub.broadcast(projectId, { type: "presence", users, count: users.length });
  }

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, "http://localhost");
    const projectId = url.searchParams.get("projectId");
    const token = url.searchParams.get("token");
    const name = (url.searchParams.get("name") || "Anonymous").slice(0, MAX_NAME_LENGTH);

    if (!projectId) {
      ws.close(CLOSE_PROJECT_REQUIRED, "projectId required");
      return;
    }
    if (typeof verifyToken === "function" && !verifyToken(token)) {
      ws.close(CLOSE_AUTH_REQUIRED, "authentication required");
      return;
    }

    ws.clientId = `c${nextClientId++}`;
    ws.userName = name;
    ws.projectId = projectId;
    hub.join(projectId, ws);

    ws.send(JSON.stringify({ type: "welcome", clientId: ws.clientId, projectId }));
    broadcastPresence(projectId);

    ws.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return; // ignore malformed frames
      }
      if (!message || typeof message.type !== "string") return;
      if (RELAYED_TYPES.has(message.type)) {
        // Tag with sender identity and relay to the rest of the room.
        hub.broadcast(
          projectId,
          { ...message, clientId: ws.clientId, name: ws.userName },
          { except: ws }
        );
      }
    });

    ws.on("close", () => {
      hub.leave(projectId, ws);
      broadcastPresence(projectId);
    });
  });

  return { wss, hub };
}

module.exports = { CollaborationHub, attachCollaboration };
