import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, wsSignalingUrl } from "../api";
import { useAuth } from "../AuthContext";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

export default function LiveRoom() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stream, setStream] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [status, setStatus] = useState("Connecting…");
  const [viewerCount, setViewerCount] = useState(0);
  const [error, setError] = useState("");

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const wsRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map()); // peerId -> RTCPeerConnection
  const myConnectionIdRef = useRef(null);
  const hostIdRef = useRef(null); // used by viewers

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      const { stream: s } = await api.get(`/api/livestreams/${id}`);
      if (cancelled) return;
      setStream(s);
      const hostRole = user?.username === s.host.username;
      setIsHost(hostRole);

      const ws = new WebSocket(wsSignalingUrl());
      wsRef.current = ws;

      ws.onopen = async () => {
        if (hostRole) {
          try {
            const media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = media;
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = media;
              localVideoRef.current.muted = true;
              localVideoRef.current.play();
            }
          } catch {
            setError("Camera access was blocked — allow camera and microphone permissions to broadcast.");
            return;
          }
        }
        ws.send(JSON.stringify({ type: "join", roomId: id, role: hostRole ? "host" : "viewer", token: localStorage.getItem("ngs_token") }));
        setStatus(hostRole ? "Live" : "Connecting to broadcaster…");
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "joined") {
          myConnectionIdRef.current = msg.connectionId;
          if (!hostRole) {
            const host = msg.peers.find((p) => p.role === "host");
            if (host) hostIdRef.current = host.id;
          } else {
            setViewerCount(msg.peers.filter((p) => p.role === "viewer").length);
          }
        }

        if (msg.type === "peer-joined" && hostRole && msg.role === "viewer") {
          setViewerCount((c) => c + 1);
          const pc = createPeerConnection(msg.peerId, ws);
          localStreamRef.current?.getTracks().forEach((track) => pc.addTrack(track, localStreamRef.current));
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          ws.send(JSON.stringify({ type: "offer", roomId: id, targetId: msg.peerId, payload: offer }));
        }

        if (msg.type === "peer-left") {
          const pc = peersRef.current.get(msg.peerId);
          if (pc) { pc.close(); peersRef.current.delete(msg.peerId); }
          if (hostRole) setViewerCount((c) => Math.max(0, c - 1));
          else setStatus("Broadcaster disconnected.");
        }

        if (msg.type === "offer" && !hostRole) {
          const pc = createPeerConnection(msg.fromId, ws);
          await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          ws.send(JSON.stringify({ type: "answer", roomId: id, targetId: msg.fromId, payload: answer }));
          setStatus("Live");
        }

        if (msg.type === "answer" && hostRole) {
          const pc = peersRef.current.get(msg.fromId);
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        }

        if (msg.type === "ice-candidate") {
          const pc = peersRef.current.get(msg.fromId);
          if (pc && msg.payload) {
            try { await pc.addIceCandidate(new RTCIceCandidate(msg.payload)); } catch { /* ignore late candidates */ }
          }
        }
      };

      ws.onerror = () => setError("Couldn't connect to the live signaling server.");
    }

    function createPeerConnection(peerId, ws) {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.onicecandidate = (e) => {
        if (e.candidate) ws.send(JSON.stringify({ type: "ice-candidate", roomId: id, targetId: peerId, payload: e.candidate }));
      };
      pc.ontrack = (e) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
          remoteVideoRef.current.play();
        }
      };
      peersRef.current.set(peerId, pc);
      return pc;
    }

    setup();

    return () => {
      cancelled = true;
      wsRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
    };
  }, [id, user]);

  async function endStream() {
    await api.post(`/api/livestreams/${id}/end`);
    navigate("/live");
  }

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      {stream && (
        <div style={{ marginBottom: 12 }}>
          <h1 className="h-display" style={{ fontSize: 20, margin: 0 }}>{stream.title}</h1>
          <p style={{ color: "var(--slate-400)", fontSize: 13 }}>
            {stream.host.displayName} · @{stream.host.username} {isHost && `· ${viewerCount} watching`}
          </p>
        </div>
      )}

      {error && <div className="card" style={{ padding: 14, color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        <video
          ref={isHost ? localVideoRef : remoteVideoRef}
          autoPlay
          playsInline
          controls={!isHost}
          style={{ width: "100%", background: "#000", maxHeight: 420, display: "block" }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="eyebrow">{status}</span>
        {isHost ? (
          <button className="btn btn-ghost btn-danger" onClick={endStream}>End stream</button>
        ) : (
          <button className="btn btn-ghost" onClick={() => navigate("/live")}>Leave</button>
        )}
      </div>
    </div>
  );
}
