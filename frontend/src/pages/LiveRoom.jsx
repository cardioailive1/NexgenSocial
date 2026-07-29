import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Device } from "mediasoup-client";
import { api, wsSignalingUrl } from "../api";
import { createSignalingClient } from "../signalingClient";
import { useAuth } from "../AuthContext";

// SFU-based live streaming: the host's camera/mic go up to the server once
// (via a mediasoup "send" transport), and every viewer pulls from the
// server (via their own "recv" transport) rather than connecting directly
// to the host. See backend/src/livestreamSignaling.js for the other half
// of this protocol.
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
  const remoteVideoRefs = useRef(new Map()); // producerId -> <video> element ref callback target
  const [remoteProducerIds, setRemoteProducerIds] = useState([]);

  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const localStreamRef = useRef(null);
  const consumersRef = useRef(new Map()); // producerId -> Consumer

  useEffect(() => {
    let cancelled = false;
    let ws;
    let signaling;

    async function setup() {
      const { stream: s } = await api.get(`/api/livestreams/${id}`);
      if (cancelled) return;
      setStream(s);
      const hostRole = user?.username === s.host.username;
      setIsHost(hostRole);

      ws = new WebSocket(wsSignalingUrl());
      signaling = createSignalingClient(ws);

      signaling.onNotification(async (type, data) => {
        if (type === "newProducer" && !hostRole) {
          await consumeProducer(data.producerId);
        }
        if (type === "peerJoined" && hostRole && data.role === "viewer") {
          setViewerCount((c) => c + 1);
        }
        if (type === "peerClosed" && !hostRole) {
          setStatus("The broadcaster ended the stream.");
        }
        if (type === "peerClosed" && hostRole) {
          setViewerCount((c) => Math.max(0, c - 1));
        }
      });

      ws.onopen = async () => {
        try {
          setStatus("Joining…");
          const { rtpCapabilities, existingProducers } = await signaling.request("join", {
            roomId: id,
            role: hostRole ? "host" : "viewer",
            token: localStorage.getItem("ngs_token"),
          });

          const device = new Device();
          await device.load({ routerRtpCapabilities: rtpCapabilities });
          deviceRef.current = device;

          if (hostRole) {
            await startBroadcasting(device);
          } else {
            await setupRecvTransport(device);
            for (const p of existingProducers) await consumeProducer(p.producerId);
            setStatus(existingProducers.length ? "Live" : "Waiting for the broadcaster…");
          }
        } catch (err) {
          setError(err.message);
        }
      };

      ws.onerror = () => setError("Couldn't connect to the live signaling server.");
    }

    async function startBroadcasting(device) {
      let media;
      try {
        media = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        setError("Camera access was blocked — allow camera and microphone permissions to broadcast.");
        return;
      }
      localStreamRef.current = media;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = media;
        localVideoRef.current.muted = true;
        localVideoRef.current.play();
      }

      const transportParams = await signaling.request("createTransport", {});
      const sendTransport = device.createSendTransport(transportParams);
      sendTransportRef.current = sendTransport;

      sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
        signaling.request("connectTransport", { transportId: sendTransport.id, dtlsParameters }).then(callback).catch(errback);
      });
      sendTransport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
        signaling.request("produce", { transportId: sendTransport.id, kind, rtpParameters }).then(({ id }) => callback({ id })).catch(errback);
      });

      for (const track of media.getTracks()) {
        await sendTransport.produce({ track });
      }
      setStatus("Live");
    }

    async function setupRecvTransport(device) {
      const transportParams = await signaling.request("createTransport", {});
      const recvTransport = device.createRecvTransport(transportParams);
      recvTransportRef.current = recvTransport;

      recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
        signaling.request("connectTransport", { transportId: recvTransport.id, dtlsParameters }).then(callback).catch(errback);
      });
    }

    async function consumeProducer(producerId) {
      const device = deviceRef.current;
      const recvTransport = recvTransportRef.current;
      if (!device || !recvTransport) return;

      const params = await signaling.request("consume", {
        transportId: recvTransport.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      });

      const consumer = await recvTransport.consume({
        id: params.id,
        producerId: params.producerId,
        kind: params.kind,
        rtpParameters: params.rtpParameters,
      });
      consumersRef.current.set(producerId, consumer);
      await signaling.request("resumeConsumer", { consumerId: consumer.id });

      setRemoteProducerIds((ids) => [...new Set([...ids, producerId])]);
      setStatus("Live");

      // Attach the track to its <video> element once React has rendered it
      setTimeout(() => {
        const el = remoteVideoRefs.current.get(producerId);
        if (el) {
          const mediaStream = new MediaStream([consumer.track]);
          el.srcObject = mediaStream;
          el.play().catch(() => {});
        }
      }, 0);
    }

    setup();

    return () => {
      cancelled = true;
      ws?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      consumersRef.current.forEach((c) => c.close());
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
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

      {isHost && (
        <div className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
          <video ref={localVideoRef} autoPlay playsInline style={{ width: "100%", background: "#000", maxHeight: 420, display: "block" }} />
        </div>
      )}

      {!isHost && remoteProducerIds.length === 0 && (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--slate-400)" }}>Waiting for video…</div>
      )}
      {!isHost && remoteProducerIds.map((pid) => (
        <div key={pid} className="card" style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
          <video
            ref={(el) => { if (el) remoteVideoRefs.current.set(pid, el); }}
            autoPlay
            playsInline
            controls
            style={{ width: "100%", background: "#000", maxHeight: 420, display: "block" }}
          />
        </div>
      ))}

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
