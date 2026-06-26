import { describe, it, expect, vi } from "vitest";
import { buildCollabUrl, createCollabConnection } from "./collab";

// Minimal fake WebSocket that records sends and lets tests emit events.
class FakeWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // OPEN
    this.sent = [];
    this.listeners = {};
  }
  addEventListener(type, handler) {
    (this.listeners[type] ||= []).push(handler);
  }
  emit(type, event) {
    (this.listeners[type] || []).forEach((handler) => handler(event));
  }
  send(data) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
}

describe("buildCollabUrl", () => {
  it("uses a ws:// scheme and encodes params", () => {
    const url = buildCollabUrl({ projectId: 7, token: "t k", name: "Ada Lovelace" });
    expect(url).toMatch(/^ws:\/\//);
    expect(url).toContain("projectId=7");
    expect(url).toContain("token=t+k");
    expect(url).toContain("name=Ada+Lovelace");
  });
});

describe("createCollabConnection", () => {
  function setup() {
    let socket;
    const onPresence = vi.fn();
    const onEdit = vi.fn();
    const onStatus = vi.fn();
    const conn = createCollabConnection({
      projectId: 1,
      token: "tok",
      name: "Me",
      onPresence,
      onEdit,
      onStatus,
      WebSocketImpl: class extends FakeWebSocket {
        constructor(url) {
          super(url);
          socket = this;
        }
      },
    });
    return {
      conn,
      get socket() {
        return socket;
      },
      onPresence,
      onEdit,
      onStatus,
    };
  }

  it("routes presence and edit messages to the right handlers", () => {
    const { socket, onPresence, onEdit } = setup();
    socket.emit("message", { data: JSON.stringify({ type: "presence", users: [], count: 0 }) });
    socket.emit("message", { data: JSON.stringify({ type: "edit", entity: "endpoint" }) });

    expect(onPresence).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ entity: "endpoint" }));
  });

  it("ignores malformed frames without throwing", () => {
    const { socket, onPresence, onEdit } = setup();
    expect(() => socket.emit("message", { data: "not json{" })).not.toThrow();
    expect(onPresence).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("reports status on open/close", () => {
    const { socket, onStatus } = setup();
    socket.emit("open");
    socket.emit("close");
    expect(onStatus).toHaveBeenCalledWith("connected");
    expect(onStatus).toHaveBeenCalledWith("disconnected");
  });

  it("sendEdit serializes an edit frame when the socket is open", () => {
    const { conn, socket } = setup();
    conn.sendEdit({ projectId: 1 });
    expect(JSON.parse(socket.sent[0])).toEqual({ type: "edit", projectId: 1 });
  });
});
