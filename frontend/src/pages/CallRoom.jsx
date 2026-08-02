import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Device } from "mediasoup-client";
import { api, wsSignalingUrl } from "../api";
import { createSignalingClient } from "../signalingClient";
import { useAuth } from "../AuthContext";

// Reuses the same mediasoup SFU that powers live streaming, with the call
// id as the room id. Audio-only by default; video is optional per call.
export default function CallRoom() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("Connecting…");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [hasVideo, setHasVideo] = useState(false);
  // Tracked separately from our own camera: the video area must exist as
  // soon as EITHER side is sending video. Previously it was gated on our
  // own camera alone, so if they enabled video and we hadn't, the <video>
  // element didn't exist, the ref was null, and their stream was dropped --
  // which looked like a permanently black screen.
  const [remoteHasVideo, setRemoteHasVideo] = useState(false);
  const pendingRemoteStreamRef = useRef(null);
  const [call, setCall] = useState(null);
  const [seconds, setSeconds] = useState(0);

  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const wsRef = useRef(null);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const consumersRef = useRef(new Map());

  useEffect(() => {
    let cancelled = false;
    let signaling;

    async function setup() {
      try {
        const { calls } = await api.get("/api/messages/calls/history");
        const thisCall = calls.find((c) => c.id === id);
        if (cancelled) return;
        setCall(thisCall || null);

        const wantVideo = thisCall?.kind === "VIDEO";
        let media;
        try {
          media = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo });
        } catch {
          setError("Microphone access was blocked. Allow it in your browser to take calls.");
          return;
        }
        localStreamRef.current = media;
        setHasVideo(wantVideo);
        if (wantVideo && localVideoRef.current) {
          localVideoRef.current.srcObject = media;
          localVideoRef.current.muted = true;
          localVideoRef.current.play().catch(() => {});
        }

        const ws = new WebSocket(wsSignalingUrl());
        wsRef.current = ws;
        signaling = createSignalingClient(ws);

        signaling.onNotification(async (type, data) => {
          if (type === "newProducer") await consume(data.producerId);
          if (type === "peerClosed") {
            setStatus("The other person hung up.");
            setTimeout(() => navigate("/messages"), 1500);
          }
        });

        ws.onopen = async () => {
          // Both sides join as "host" so each can publish -- a call is
          // symmetric, unlike a broadcast where only one side sends.
          const { rtpCapabilities, existingProducers } = await signaling.request("join", {
            roomId: `call-${id}`,
            role: "host",
            token: localStorage.getItem("ngs_token"),
          });

          const device = new Device();
          await device.load({ routerRtpCapabilities: rtpCapabilities });
          deviceRef.current = device;

          // Send
          const sendParams = await signaling.request("createTransport", {});
          const sendTransport = device.createSendTransport(sendParams);
          sendTransportRef.current = sendTransport;
          sendTransport.on("connect", ({ dtlsParameters }, cb, eb) => {
            signaling.request("connectTransport", { transportId: sendTransport.id, dtlsParameters }).then(cb).catch(eb);
          });
          sendTransport.on("produce", ({ kind, rtpParameters }, cb, eb) => {
            signaling.request("produce", { transportId: sendTransport.id, kind, rtpParameters })
              .then(({ id }) => cb({ id })).catch(eb);
          });
          for (const track of media.getTracks()) await sendTransport.produce({ track });

          // Receive
          const recvParams = await signaling.request("createTransport", {});
          const recvTransport = device.createRecvTransport(recvParams);
          recvTransportRef.current = recvTransport;
          recvTransport.on("connect", ({ dtlsParameters }, cb, eb) => {
            signaling.request("connectTransport", { transportId: recvTransport.id, dtlsParameters }).then(cb).catch(eb);
          });

          for (const p of existingProducers) await consume(p.producerId);

          await api.patch(`/api/messages/calls/${id}`, { status: "ACTIVE" }).catch(() => {});
          setStatus("Connected");
        };

        ws.onerror = () => setError("Couldn't reach the call server.");
      } catch (err) {
        setError(err.message);
      }
    }

    async function consume(producerId) {
      const device = deviceRef.current;
      const recvTransport = recvTransportRef.current;
      if (!device || !recvTransport || consumersRef.current.has(producerId)) return;

      const params = await signaling.request("consume", {
        transportId: recvTransport.id,
        producerId,
        rtpCapabilities: device.rtpCapabilities,
      });
      const consumer = await recvTransport.consume({
        id: params.id, producerId: params.producerId,
        kind: params.kind, rtpParameters: params.rtpParameters,
      });
      consumersRef.current.set(producerId, consumer);
      await signaling.request("resumeConsumer", { consumerId: consumer.id });

      const stream = new MediaStream([consumer.track]);
      if (consumer.kind === "audio") {
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => {});
        }
      } else if (consumer.kind === "video") {
        // Stash the stream and flip the flag; the effect below attaches it
        // once React has actually rendered the <video> element. Assigning
        // to the ref here would be a no-op on the first video track,
        // because the element doesn't exist yet.
        pendingRemoteStreamRef.current = stream;
        setRemoteHasVideo(true);
      }
      setStatus("Connected");
    }

    setup();
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);

    return () => {
      cancelled = true;
      clearInterval(timer);
      wsRef.current?.close();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      consumersRef.current.forEach((c) => c.close());
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
    };
  }, [id]);

  // Runs after the video element is mounted, which is the only point at
  // which the ref is non-null.
  useEffect(() => {
    if (remoteHasVideo && pendingRemoteStreamRef.current && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = pendingRemoteStreamRef.current;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [remoteHasVideo]);

  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }

  // Disabling the track rather than stopping it keeps the transport and
  // producer alive, so the camera can come back on without renegotiating
  // the whole connection.
  function toggleCamera() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOff(!track.enabled);
  }

  // Lets an audio call become a video call mid-conversation, which is how
  // these usually start -- you ring someone, then decide to show them
  // something.
  async function addVideo() {
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = camStream.getVideoTracks()[0];
      localStreamRef.current?.addTrack(track);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
      await sendTransportRef.current?.produce({ track });
      setHasVideo(true);
      setCameraOff(false);
    } catch {
      setError("Couldn't turn on the camera. Check your browser permissions.");
    }
  }

  async function hangUp() {
    await api.patch(`/api/messages/calls/${id}`, { status: "ENDED" }).catch(() => {});
    navigate("/messages");
  }

  const other = call
    ? (call.caller.username === user?.username ? call.callee : call.caller)
    : null;
  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="container" style={{ maxWidth: 520, paddingTop: 40, paddingBottom: 60, textAlign: "center" }}>
      {error && <div className="card" style={{ padding: 14, color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <img className="avatar" style={{ width: 88, height: 88, margin: "0 auto 14px" }}
        src={api.mediaUrl(other?.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${other?.username || "call"}`} alt="" />
      <h1 className="h-display" style={{ fontSize: 22, margin: 0 }}>{other?.displayName || "Call"}</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 13, marginTop: 4 }}>{status} · {mmss}</p>

      {(hasVideo || remoteHasVideo) && (
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center", flexWrap: "wrap" }}>
          <video ref={remoteVideoRef} autoPlay playsInline
            style={{ width: "100%", maxWidth: 360, borderRadius: 12, background: "#000", aspectRatio: "4/3", objectFit: "cover" }} />
          {hasVideo && (
            <video ref={localVideoRef} autoPlay playsInline muted
              style={{ width: 120, borderRadius: 10, background: "#000", aspectRatio: "4/3", objectFit: "cover", border: "1px solid var(--line)" }} />
          )}
        </div>
      )}

      <audio ref={remoteAudioRef} autoPlay />

      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 24 }}>
        <button className="btn btn-ghost" onClick={toggleMute}>{muted ? "🔇 Unmute" : "🎤 Mute"}</button>
        {hasVideo ? (
          <button className="btn btn-ghost" onClick={toggleCamera}>{cameraOff ? "📷 Camera on" : "🚫 Camera off"}</button>
        ) : (
          <button className="btn btn-ghost" onClick={addVideo}>🎥 Turn on video</button>
        )}
        <button className="btn btn-primary" onClick={hangUp} style={{ background: "var(--danger)", color: "#fff" }}>End call</button>
      </div>
    </div>
  );
}
