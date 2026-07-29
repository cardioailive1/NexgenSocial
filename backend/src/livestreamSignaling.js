const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");

// Minimal WebRTC signaling relay for live streams. This server never sees
// or touches the actual video -- it only relays small JSON messages (SDP
// offers/answers, ICE candidates) between a stream's host and its viewers,
// who then connect to each other directly (peer-to-peer). That's why this
// scales to a handful of concurrent viewers per host and no further: every
// viewer is a separate direct connection from the host's own upload
// bandwidth. Real broadcast scale (thousands of viewers) needs a media
// server (SFU) in the middle -- a hosted one (LiveKit, Mux, Cloudflare
// Stream) is the practical swap-in, and like the OAuth providers earlier,
// that requires an account and credentials only you can create.
//
// Message shape: { type, roomId, targetId?, payload? }
// type: "join" | "offer" | "answer" | "ice-candidate" | "leave" | "peer-joined" | "peer-left"

function attachSignaling(httpServer) {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws/live" });

  // roomId -> Map(connectionId -> { ws, role, userId })
  const rooms = new Map();

  wss.on("connection", (ws, req) => {
    let connectionId = null;
    let roomId = null;

    ws.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }

      if (msg.type === "join") {
        roomId = msg.roomId;
        connectionId = `${msg.role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        let userId = null;
        try {
          const token = msg.token;
          if (token) userId = jwt.verify(token, process.env.JWT_SECRET).sub;
        } catch {
          // anonymous viewers are allowed to watch; only starting a stream requires auth (enforced over REST)
        }

        if (!rooms.has(roomId)) rooms.set(roomId, new Map());
        const room = rooms.get(roomId);

        // tell the new peer who's already in the room (so viewers know the host's id, etc.)
        ws.send(JSON.stringify({
          type: "joined",
          connectionId,
          peers: [...room.entries()].map(([id, p]) => ({ id, role: p.role })),
        }));

        // tell existing peers someone new arrived
        for (const [, peer] of room) {
          peer.ws.send(JSON.stringify({ type: "peer-joined", peerId: connectionId, role: msg.role }));
        }

        room.set(connectionId, { ws, role: msg.role, userId });
        return;
      }

      if (!roomId || !connectionId) return;
      const room = rooms.get(roomId);
      if (!room) return;

      if (["offer", "answer", "ice-candidate"].includes(msg.type)) {
        const target = room.get(msg.targetId);
        if (target) {
          target.ws.send(JSON.stringify({ ...msg, fromId: connectionId }));
        }
      }
    });

    ws.on("close", () => {
      if (!roomId || !connectionId) return;
      const room = rooms.get(roomId);
      if (!room) return;
      room.delete(connectionId);
      for (const [, peer] of room) {
        peer.ws.send(JSON.stringify({ type: "peer-left", peerId: connectionId }));
      }
      if (room.size === 0) rooms.delete(roomId);
    });
  });

  return wss;
}

module.exports = { attachSignaling };
