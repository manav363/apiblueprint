const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { WebSocket } = require("ws");

const { CollaborationHub, attachCollaboration } = require("../collab");

// ── Unit: the room hub ─────────────────────────────────────
describe("CollaborationHub", () => {
  it("tracks join/leave per project room", () => {
    const hub = new CollaborationHub();
    const a = { clientId: "a", userName: "A", readyState: WebSocket.OPEN, send() {} };
    const b = { clientId: "b", userName: "B", readyState: WebSocket.OPEN, send() {} };

    hub.join("1", a);
    hub.join("1", b);
    assert.equal(hub.roster("1").length, 2);

    hub.leave("1", a);
    assert.deepEqual(
      hub.roster("1").map((u) => u.clientId),
      ["b"]
    );

    hub.leave("1", b);
    assert.equal(hub.roster("1").length, 0);
  });

  it("broadcasts only to the same room and skips the sender", () => {
    const hub = new CollaborationHub();
    const received = [];
    const make = (id, room) => {
      const client = {
        clientId: id,
        userName: id,
        readyState: WebSocket.OPEN,
        send: (data) => received.push([id, JSON.parse(data)]),
      };
      hub.join(room, client);
      return client;
    };
    const a = make("a", "1");
    make("b", "1");
    make("c", "2"); // different room

    const sent = hub.broadcast("1", { type: "edit", value: 7 }, { except: a });
    assert.equal(sent, 1); // only b
    assert.deepEqual(received, [["b", { type: "edit", value: 7 }]]);
  });
});

// ── Integration: real WebSocket clients ────────────────────
describe("collaboration websocket", () => {
  let server;
  let url;

  before(() => {
    server = http.createServer((req, res) => res.end("ok"));
    attachCollaboration(server, { verifyToken: (t) => t === "good" });
    return new Promise((resolve) => {
      server.listen(0, () => {
        url = `ws://127.0.0.1:${server.address().port}/collab`;
        resolve();
      });
    });
  });

  after(() => {
    if (server) server.close();
  });

  function connect(projectId, name, token = "good") {
    const ws = new WebSocket(
      `${url}?projectId=${projectId}&name=${encodeURIComponent(name)}&token=${token}`
    );
    ws.messages = [];
    ws.on("message", (raw) => ws.messages.push(JSON.parse(raw.toString())));
    return ws;
  }

  function waitFor(ws, predicate, timeout = 2000) {
    return new Promise((resolve, reject) => {
      const found = ws.messages.find(predicate);
      if (found) return resolve(found);
      const timer = setTimeout(() => reject(new Error("timed out waiting for message")), timeout);
      ws.on("message", (raw) => {
        const msg = JSON.parse(raw.toString());
        if (predicate(msg)) {
          clearTimeout(timer);
          resolve(msg);
        }
      });
    });
  }

  it("rejects a connection without projectId", async () => {
    const ws = new WebSocket(`${url}?token=good`);
    const code = await new Promise((resolve) => ws.on("close", resolve));
    assert.equal(code, 4400);
  });

  it("rejects a connection with a bad token", async () => {
    const ws = connect("1", "Nope", "bad");
    const code = await new Promise((resolve) => ws.on("close", resolve));
    assert.equal(code, 4401);
  });

  it("broadcasts presence and relays edits between two clients", async () => {
    const alice = connect("42", "Alice");
    await waitFor(alice, (m) => m.type === "welcome");

    const bob = connect("42", "Bob");
    await waitFor(bob, (m) => m.type === "welcome");

    // Both should see a presence update with two users.
    const presence = await waitFor(alice, (m) => m.type === "presence" && m.count === 2);
    const names = presence.users.map((u) => u.name).sort();
    assert.deepEqual(names, ["Alice", "Bob"]);

    // Alice edits → Bob receives it, tagged with Alice's identity.
    alice.send(JSON.stringify({ type: "edit", entity: "endpoint", action: "created" }));
    const relayed = await waitFor(bob, (m) => m.type === "edit");
    assert.equal(relayed.entity, "endpoint");
    assert.equal(relayed.name, "Alice");

    // Bob leaves → Alice sees presence drop to 1.
    bob.close();
    const after = await waitFor(alice, (m) => m.type === "presence" && m.count === 1);
    assert.equal(after.users[0].name, "Alice");

    alice.close();
  });
});
