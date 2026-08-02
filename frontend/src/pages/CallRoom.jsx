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
        // Fetch THIS call directly. Previously we scanned /calls/history
        // and picked the matching id -- but that list is capped at 50 and a
        // just-created call can be absent, in which case `thisCall` was
        // undefined, `wantVideo` silently became false, and the camera was
        // never requested at all. That produced a black screen on every
        // video call, with no error to explain it.
        let thisCall = null;
        try {
          const res = await api.get(`/api/messages/calls/${id}/details`);
          thisCall = res.call;
        } catch (err) {
          console.error("[call] couldn't load call details:", err.message);
          setError("Couldn't load this call. It may have ended.");
          return;
        }
        if (cancelled) return;
        setCall(thisCall);

        const wantVideo = thisCall?.kind === "VIDEO";
        console.log("[call] kind:", thisCall?.kind, "→ requesting video:", wantVideo);
        let media;
        try {
          media = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo });
        } catch (err) {
          // Distinguish the causes -- "blocked" and "no camera attached"
          // look identical on screen but need completely different fixes.
          const name = err?.name || "";
          if (name === "NotAllowedError") {
            setError("Camera/microphone access was denied. Click the padlock in your address bar → Site settings → allow Camera and Microphone, then reload.");
          } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
            setError("No camera or microphone was found on this device.");
          } else if (name === "NotReadableError") {
            setError("Your camera is already in use by another app or tab. Close it and try again.");
          } else {
            setError(`Couldn't access camera/microphone: ${err?.message || name}`);
          }
          console.error("[call] getUserMedia failed:", err);
          return;
        }

        console.log("[call] local tracks:", media.getTracks().map((t) => `${t.kind}:${t.readyState}`));
        localStreamRef.current = media;
        setHasVideo(wantVideo && media.getVideoTracks().length > 0);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = media;
          localVideoRef.current.muted = true;
          // Chrome rejects play() if the element isn't laid out yet; a
          // failure here is exactly what a black preview looks like.
          localVideoRef.current.play().catch((e) => console.warn("[call] local play() rejected:", e?.message));
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
        try {
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

          // Only the CALLEE marks a call active. The caller marking it
          // active on entry was a real bug: it flipped the call out of
          // RINGING within a second or two, so the callee's poll (which
          // looks for RINGING) never found it and the phone never rang.
          const iAmCallee = thisCall && thisCall.callee?.username === user?.username;
          if (iAmCallee) {
            await api.patch(`/api/messages/calls/${id}`, { status: "ACTIVE" }).catch(() => {});
          }
          setStatus(iAmCallee ? "Connected" : "Ringing…");
        } catch (err) {
          // Previously this threw into nothing: an async handler's
          // rejection is unhandled, so a mediasoup or signalling failure
          // showed up only as the generic onerror message below, with the
          // real cause invisible.
          console.error("[call] setup failed:", err);
          setError(`Call setup failed: ${err?.message || err}`);
        }
        };

        ws.onerror = (e) => {
          console.error("[call] websocket error:", e);
          setError("Lost connection to the call server.");
        };

        ws.onclose = (e) => {
          // 1000/1005 are normal closes (hanging up, navigating away) and
          // must not be reported as failures.
          if (e.code !== 1000 && e.code !== 1005) {
            console.warn("[call] websocket closed unexpectedly:", e.code, e.reason);
          }
        };
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
        console.log("[call] remote video track received:", consumer.track.readyState);
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

  // Ringback for the caller: a repeating tone while waiting for an answer,
  // so an unanswered call sounds like an unanswered call rather than a
  // silent frozen screen. Stops the moment the status changes to Connected.
  // Created up front and unlocked on the first user gesture, rather than
  // built on demand when ringing starts. Constructing an AudioContext at
  // ring time is exactly what triggers "An AudioContext was prevented from
  // starting automatically" -- by then there may have been no gesture on
  // this page, and the context is born suspended and stays that way.
  const ringbackCtxRef = useRef(null);

  useEffect(() => {
    function unlock() {
      try {
        if (!ringbackCtxRef.current) {
          ringbackCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (ringbackCtxRef.current.state === "suspended") {
          ringbackCtxRef.current.resume().catch(() => {});
        }
      } catch { /* silent ringback is survivable */ }
    }
    const events = ["click", "keydown", "touchstart"];
    events.forEach((e) => window.addEventListener(e, unlock));
    unlock();
    return () => events.forEach((e) => window.removeEventListener(e, unlock));
  }, []);

  useEffect(() => {
    if (status !== "Ringing…") return;
    let stopped = false;

    function tone() {
      if (stopped) return;
      const ctx = ringbackCtxRef.current;
      // No context yet, or still suspended, means no gesture has happened
      // on this page. Skip quietly instead of constructing one and
      // generating a console warning on every tick.
      if (!ctx || ctx.state !== "running") return;
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 420;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.0);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 1.05);
      } catch { /* silent ringback is survivable */ }
    }

    tone();
    const t = setInterval(tone, 3000);
    return () => { stopped = true; clearInterval(t); };
  }, [status]);

  // Runs after the video element is mounted, which is the only point at
  // which the ref is non-null.
  useEffect(() => {
    if (remoteHasVideo && pendingRemoteStreamRef.current && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = pendingRemoteStreamRef.current;
      remoteVideoRef.current.play().catch((e) => console.warn("[call] remote play() rejected:", e?.message));
    }
  }, [remoteHasVideo]);

  // The local preview has the same mount-order problem: hasVideo flips to
  // true and only THEN does the <video> render, so assigning srcObject at
  // getUserMedia time can hit a null ref and leave a black rectangle.
  useEffect(() => {
    if (hasVideo && localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch((e) => console.warn("[call] local play() rejected:", e?.message));
    }
  }, [hasVideo]);

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
      <p style={{ color: status === "Ringing…" ? "var(--cyan-300)" : "var(--slate-400)", fontSize: 13, marginTop: 4 }}>
        {status} · {mmss}
      </p>
      {status === "Ringing…" && (
        <p style={{ fontSize: 11.5, color: "var(--slate-400)", marginTop: 2 }}>
          They'll only see this if they have NexgenSocial open in a browser tab.
        </p>
      )}

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
