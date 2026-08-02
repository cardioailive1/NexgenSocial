import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Device } from "mediasoup-client";
import { api, wsSignalingUrl } from "../api";
import { createSignalingClient } from "../signalingClient";
import { useAuth } from "../AuthContext";

// A remote participant's tile. Each peer gets its own <video>, mounted
// before any track arrives so the ref is never null when we attach --
// the same ordering bug that made 1:1 calls show a black screen.
function PeerTile({ peerId, stream, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }
  }, [stream]);

  return (
    <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000", border: "1px solid var(--line)" }}>
      <video ref={ref} autoPlay playsInline style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
      <div style={{ position: "absolute", bottom: 6, left: 8, fontSize: 11, background: "rgba(6,15,28,0.8)", padding: "2px 7px", borderRadius: 999 }}>
        {label || peerId.slice(0, 12)}
      </div>
    </div>
  );
}

export default function MeetingRoom() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [meeting, setMeeting] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [recordings, setRecordings] = useState([]);
  const [isHost, setIsHost] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [status, setStatus] = useState("Joining…");
  const [error, setError] = useState("");

  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [remoteStreams, setRemoteStreams] = useState({}); // peerId -> MediaStream
  const [chat, setChat] = useState([]);
  const [chatBody, setChatBody] = useState("");
  const [showPanel, setShowPanel] = useState("people");

  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const wsRef = useRef(null);
  const signalingRef = useRef(null);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const consumersRef = useRef(new Map());
  const recorderRef = useRef(null);
  const recordChunksRef = useRef([]);
  const screenTrackRef = useRef(null);

  async function loadMeeting() {
    try {
      const data = await api.get(`/api/meetings/${id}`);
      setMeeting(data.meeting);
      setParticipants(data.participants);
      setRecordings(data.recordings || []);
      setIsHost(data.isHost);
      setCanManage(data.canManage);
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  }

  // --- Join, then connect media once admitted ---
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const joinRes = await api.post(`/api/meetings/${id}/join`).catch((err) => {
        setError(err.message);
        return null;
      });
      if (!joinRes || cancelled) return;

      await loadMeeting();

      if (joinRes.waiting) {
        setWaiting(true);
        setStatus("Waiting for the host to let you in…");
        return;
      }
      connectMedia();
    })();

    return () => { cancelled = true; cleanup(); };
  }, [id]);

  // Waiting-room poll: checks whether the host has admitted us yet.
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(async () => {
      try {
        const s = await api.get(`/api/meetings/${id}/my-status`);
        if (s.removed) {
          setError("The host removed you from this meeting.");
          setWaiting(false);
          return;
        }
        if (s.admitted) {
          setWaiting(false);
          connectMedia();
        }
      } catch { /* keep waiting */ }
    }, 3000);
    return () => clearInterval(t);
  }, [waiting, id]);

  // Roster + chat refresh while in the meeting.
  useEffect(() => {
    if (waiting) return;
    const t = setInterval(() => {
      loadMeeting();
      api.get(`/api/meetings/${id}/chat`).then(({ messages }) => setChat(messages)).catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [waiting, id]);

  async function connectMedia() {
    setStatus("Connecting…");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => null);
      if (!media) {
        setError("Camera or microphone access was blocked. Allow both in your browser to take part.");
        return;
      }
      localStreamRef.current = media;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = media;
        localVideoRef.current.muted = true;
        localVideoRef.current.play().catch(() => {});
      }

      const ws = new WebSocket(wsSignalingUrl());
      wsRef.current = ws;
      const signaling = createSignalingClient(ws);
      signalingRef.current = signaling;

      signaling.onNotification(async (type, data) => {
        if (type === "newProducer") await consume(data.producerId, data.peerId);
        if (type === "peerClosed") {
          setRemoteStreams((s) => {
            const next = { ...s };
            delete next[data.peerId];
            return next;
          });
        }
      });

      ws.onopen = async () => {
        const { rtpCapabilities, existingProducers } = await signaling.request("join", {
          roomId: `meet-${id}`,
          role: "host", // everyone publishes in a meeting
          token: localStorage.getItem("ngs_token"),
        });

        const device = new Device();
        await device.load({ routerRtpCapabilities: rtpCapabilities });
        deviceRef.current = device;

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

        const recvParams = await signaling.request("createTransport", {});
        const recvTransport = device.createRecvTransport(recvParams);
        recvTransportRef.current = recvTransport;
        recvTransport.on("connect", ({ dtlsParameters }, cb, eb) => {
          signaling.request("connectTransport", { transportId: recvTransport.id, dtlsParameters }).then(cb).catch(eb);
        });

        for (const p of existingProducers) await consume(p.producerId, p.peerId);
        setStatus("Connected");
      };

      ws.onerror = () => setError("Couldn't reach the meeting server.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function consume(producerId, peerId) {
    const device = deviceRef.current;
    const recvTransport = recvTransportRef.current;
    const signaling = signalingRef.current;
    if (!device || !recvTransport || consumersRef.current.has(producerId)) return;

    const params = await signaling.request("consume", {
      transportId: recvTransport.id, producerId, rtpCapabilities: device.rtpCapabilities,
    });
    const consumer = await recvTransport.consume({
      id: params.id, producerId: params.producerId,
      kind: params.kind, rtpParameters: params.rtpParameters,
    });
    consumersRef.current.set(producerId, consumer);
    await signaling.request("resumeConsumer", { consumerId: consumer.id });

    // Audio and video for the same peer land in one MediaStream so a single
    // <video> element carries both.
    setRemoteStreams((prev) => {
      const key = peerId || producerId;
      const existing = prev[key];
      const stream = existing || new MediaStream();
      stream.addTrack(consumer.track);
      return { ...prev, [key]: stream };
    });
  }

  function cleanup() {
    wsRef.current?.close();
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenTrackRef.current?.stop();
    consumersRef.current.forEach((c) => c.close());
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  // --- Local controls ---
  function toggleMute() {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }

  function toggleCamera() {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setCameraOff(!track.enabled);
  }

  async function shareScreen() {
    if (!meeting?.allowParticipantScreenShare && !canManage) {
      setError("The host has turned off screen sharing for participants.");
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const track = display.getVideoTracks()[0];
      screenTrackRef.current = track;
      await sendTransportRef.current?.produce({ track });
      setSharing(true);
      // Stops cleanly when the browser's own "stop sharing" bar is used.
      track.onended = () => { setSharing(false); screenTrackRef.current = null; };
    } catch {
      setError("Screen sharing was cancelled or blocked.");
    }
  }

  // --- Recording ---
  // Records what this browser can see and hear, then uploads it. The host
  // decides afterwards whether to publish or keep it private -- recordings
  // are never public by default.
  function startRecording() {
    const localStream = localStreamRef.current;
    if (!localStream) return;

    const mixed = new MediaStream();
    localStream.getTracks().forEach((t) => mixed.addTrack(t));
    Object.values(remoteStreams).forEach((s) => s.getTracks().forEach((t) => mixed.addTrack(t)));

    const candidates = ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"];
    const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t));
    let rec;
    try {
      rec = mimeType ? new MediaRecorder(mixed, { mimeType }) : new MediaRecorder(mixed);
    } catch {
      setError("This browser can't record meetings. Try Chrome or Firefox.");
      return;
    }

    recordChunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) recordChunksRef.current.push(e.data); };
    rec.onstop = async () => {
      const blob = new Blob(recordChunksRef.current, { type: rec.mimeType || "video/webm" });
      const fd = new FormData();
      fd.append("recording", blob, `meeting-${id}-${Date.now()}.webm`);
      try {
        await api.upload(`/api/meetings/${id}/recordings`, fd);
        await loadMeeting();
      } catch (err) {
        setError(`Recording upload failed: ${err.message}`);
      }
    };
    rec.start();
    recorderRef.current = rec;
    setRecording(true);
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  // --- Host actions ---
  async function hostAction(fn) {
    try { await fn(); await loadMeeting(); }
    catch (err) { setError(err.message); }
  }

  async function endMeeting() {
    await api.post(`/api/meetings/${id}/end`).catch(() => {});
    cleanup();
    navigate("/meetings");
  }

  async function leave() {
    await api.post(`/api/meetings/${id}/leave`).catch(() => {});
    cleanup();
    navigate("/meetings");
  }

  async function sendChat(e) {
    e.preventDefault();
    if (!chatBody.trim()) return;
    try {
      const { message } = await api.post(`/api/meetings/${id}/chat`, { body: chatBody });
      setChat((c) => [...c, message]);
      setChatBody("");
    } catch (err) { setError(err.message); }
  }

  async function publishRecording(recordingId) {
    await hostAction(() => api.post(`/api/meetings/recordings/${recordingId}/publish`, {}));
  }
  async function unpublishRecording(recordingId) {
    await hostAction(() => api.post(`/api/meetings/recordings/${recordingId}/unpublish`, {}));
  }

  const waitingList = participants.filter((p) => !p.admitted);
  const admitted = participants.filter((p) => p.admitted);

  if (waiting) {
    return (
      <div className="container" style={{ maxWidth: 460, paddingTop: 60, textAlign: "center" }}>
        <h1 className="h-display" style={{ fontSize: 20 }}>{meeting?.title || "Meeting"}</h1>
        <p style={{ color: "var(--slate-400)", fontSize: 14, marginTop: 10 }}>{status}</p>
        {error && <div className="card" style={{ padding: 12, color: "var(--danger)", fontSize: 13, marginTop: 16 }}>{error}</div>}
        <button className="btn btn-ghost" onClick={() => navigate("/meetings")} style={{ marginTop: 20 }}>Cancel</button>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 1000, paddingTop: 20, paddingBottom: 60 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <h1 className="h-display" style={{ fontSize: 19, margin: 0 }}>{meeting?.title || "Meeting"}</h1>
          <div style={{ fontSize: 11, color: "var(--slate-400)" }}>
            {status} · Code <strong style={{ color: "var(--cyan-300)", fontFamily: "var(--font-mono)" }}>{meeting?.code}</strong>
            {recording && <span style={{ color: "var(--danger)" }}> · ● RECORDING</span>}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {isHost
            ? <button className="btn btn-primary" onClick={endMeeting} style={{ background: "var(--danger)", color: "#fff" }}>End meeting</button>
            : <button className="btn btn-ghost" onClick={leave}>Leave</button>}
        </div>
      </div>

      {error && <div className="card" style={{ padding: 12, color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        {/* Video grid */}
        <div style={{ flex: "2 1 460px", minWidth: 300 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
            <div style={{ position: "relative", borderRadius: 10, overflow: "hidden", background: "#000", border: "1px solid var(--cyan-400)" }}>
              <video ref={localVideoRef} autoPlay playsInline muted
                style={{ width: "100%", aspectRatio: "4/3", objectFit: "cover", display: "block" }} />
              <div style={{ position: "absolute", bottom: 6, left: 8, fontSize: 11, background: "rgba(6,15,28,0.8)", padding: "2px 7px", borderRadius: 999 }}>
                You {muted && "🔇"} {cameraOff && "📷✕"}
              </div>
            </div>
            {Object.entries(remoteStreams).map(([peerId, stream]) => (
              <PeerTile key={peerId} peerId={peerId} stream={stream} />
            ))}
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={toggleMute}>{muted ? "🔇 Unmute" : "🎤 Mute"}</button>
            <button className="btn btn-ghost" onClick={toggleCamera}>{cameraOff ? "📷 Camera on" : "🚫 Camera off"}</button>
            <button className="btn btn-ghost" onClick={shareScreen} disabled={sharing}>
              {sharing ? "🖥 Sharing" : "🖥 Share screen"}
            </button>
            {isHost && (
              recording
                ? <button className="btn btn-ghost btn-danger" onClick={stopRecording}>⏹ Stop recording</button>
                : <button className="btn btn-ghost" onClick={startRecording}>⏺ Record</button>
            )}
          </div>
        </div>

        {/* Side panel */}
        <div style={{ flex: "1 1 260px", minWidth: 240 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[["people", `People (${admitted.length})`], ["chat", "Chat"], ...(isHost ? [["recordings", "Recordings"]] : [])].map(([k, l]) => (
              <button key={k} className="btn" onClick={() => setShowPanel(k)}
                style={{ fontSize: 11, padding: "6px 10px", background: showPanel === k ? "var(--cyan-400)" : "var(--navy-800)", color: showPanel === k ? "var(--navy-950)" : "var(--slate-300)", border: "1px solid var(--line)" }}>
                {l}
              </button>
            ))}
          </div>

          {showPanel === "people" && (
            <div className="card" style={{ padding: 12 }}>
              {canManage && waitingList.length > 0 && (
                <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--line)" }}>
                  <div className="eyebrow" style={{ fontSize: 10, marginBottom: 8, color: "var(--cyan-300)" }}>
                    Waiting to join ({waitingList.length})
                  </div>
                  {waitingList.map((p) => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ flex: 1, fontSize: 12 }}>{p.user.displayName}</span>
                      <button className="btn btn-primary" style={{ fontSize: 10, padding: "4px 8px" }}
                        onClick={() => hostAction(() => api.post(`/api/meetings/${id}/participants/${p.id}/admit`, {}))}>
                        Admit
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {admitted.map((p) => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <img className="avatar" style={{ width: 26, height: 26 }}
                    src={api.mediaUrl(p.user.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${p.user.username}`} alt="" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{p.user.displayName}</div>
                    <div style={{ fontSize: 10, color: "var(--slate-400)" }}>
                      {p.role}{p.mutedByHost ? " · muted" : ""}
                    </div>
                  </div>
                  {canManage && p.role !== "HOST" && (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button title="Mute" style={{ fontSize: 12 }}
                        onClick={() => hostAction(() => api.post(`/api/meetings/${id}/participants/${p.id}/mute`, { muted: !p.mutedByHost }))}>
                        {p.mutedByHost ? "🔊" : "🔇"}
                      </button>
                      <button title="Remove" style={{ fontSize: 12, color: "var(--danger)" }}
                        onClick={() => hostAction(() => api.post(`/api/meetings/${id}/participants/${p.id}/remove`, {}))}>
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {canManage && meeting && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                  <div className="eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>Host controls</div>
                  {[
                    ["locked", "Lock meeting (no new joiners)"],
                    ["waitingRoomEnabled", "Waiting room"],
                    ["allowParticipantScreenShare", "Allow screen share"],
                    ["allowChat", "Allow chat"],
                  ].map(([key, label]) => (
                    <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5, color: "var(--slate-300)", marginBottom: 6 }}>
                      <input type="checkbox" checked={!!meeting[key]}
                        onChange={(e) => hostAction(() => api.patch(`/api/meetings/${id}/settings`, { [key]: e.target.checked }))} />
                      {label}
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {showPanel === "chat" && (
            <div className="card" style={{ padding: 12 }}>
              <div style={{ maxHeight: 300, overflowY: "auto", marginBottom: 10 }}>
                {chat.length === 0 && <p style={{ fontSize: 12, color: "var(--slate-400)" }}>No messages yet.</p>}
                {chat.map((m) => (
                  <div key={m.id} style={{ fontSize: 12, marginBottom: 7 }}>
                    <strong>{m.sender.displayName}</strong>{" "}
                    <span style={{ color: "var(--slate-300)" }}>{m.body}</span>
                  </div>
                ))}
              </div>
              <form onSubmit={sendChat} style={{ display: "flex", gap: 6 }}>
                <input type="text" placeholder="Message…" value={chatBody} onChange={(e) => setChatBody(e.target.value)} style={{ fontSize: 12 }} />
                <button className="btn btn-primary" type="submit" style={{ fontSize: 11, padding: "6px 10px" }}>Send</button>
              </form>
            </div>
          )}

          {showPanel === "recordings" && isHost && (
            <div className="card" style={{ padding: 12 }}>
              {recordings.length === 0 && <p style={{ fontSize: 12, color: "var(--slate-400)" }}>No recordings yet.</p>}
              {recordings.map((r) => (
                <div key={r.id} style={{ padding: 10, background: "var(--navy-950)", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 8 }}>
                  <video src={api.mediaUrl(r.url)} controls style={{ width: "100%", borderRadius: 6, background: "#000" }} />
                  <div style={{ fontSize: 10, color: "var(--slate-400)", marginTop: 6 }}>
                    {new Date(r.createdAt).toLocaleString()} · {r.visibility === "PUBLIC" ? "Published" : "Private"}
                  </div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <a href={api.mediaUrl(r.url)} download className="btn btn-ghost" style={{ fontSize: 10, padding: "5px 9px" }}>
                      ⤓ Download
                    </a>
                    {r.visibility === "PUBLIC"
                      ? <button className="btn btn-ghost btn-danger" style={{ fontSize: 10, padding: "5px 9px" }} onClick={() => unpublishRecording(r.id)}>Unpublish</button>
                      : <button className="btn btn-primary" style={{ fontSize: 10, padding: "5px 9px" }} onClick={() => publishRecording(r.id)}>Post publicly</button>}
                  </div>
                </div>
              ))}
              <p style={{ fontSize: 10, color: "var(--slate-400)", marginTop: 8, lineHeight: 1.5 }}>
                Recordings stay private until you publish them. Let participants
                know before you record.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
