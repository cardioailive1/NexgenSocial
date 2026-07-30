import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import ReelEditor, { COLOR_GRADES } from "../components/ReelEditor";

const MAX_REEL_SECONDS = 90;

// --- One reel in the vertical feed ---------------------------------------
function ReelCard({ reel, isActive, onViewTracked }) {
  const videoRef = useRef(null);
  const [liked, setLiked] = useState(reel.likedByViewer);
  const [likeCount, setLikeCount] = useState(reel.likeCount);
  const [showStats, setShowStats] = useState(false);
  const watchedRef = useRef(0);
  const reportedRef = useRef(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.play().catch(() => {});
    } else {
      v.pause();
      // Report whatever was watched when scrolling away, so partial views
      // still count as ranking signal rather than being lost.
      flushView();
    }
  }, [isActive]);

  function flushView() {
    if (reportedRef.current || watchedRef.current < 0.5) return;
    reportedRef.current = true;
    const v = videoRef.current;
    const completed = v && v.duration ? watchedRef.current >= v.duration * 0.9 : false;
    api.post(`/api/reels/${reel.id}/view`, { watchedSec: watchedRef.current, completed })
      .then(() => onViewTracked?.())
      .catch(() => {});
  }

  useEffect(() => () => flushView(), []);

  function onTimeUpdate() {
    const v = videoRef.current;
    if (v) watchedRef.current = Math.max(watchedRef.current, v.currentTime);
  }

  function onEnded() {
    const v = videoRef.current;
    if (!v) return;
    watchedRef.current = v.duration;
    flushView();
    // Loop, like every short-form feed does -- replays are a real signal,
    // and the backend counts repeat views as replays.
    reportedRef.current = false;
    v.currentTime = 0;
    v.play().catch(() => {});
  }

  async function toggleLike() {
    setLiked((v) => !v);
    setLikeCount((c) => c + (liked ? -1 : 1));
    try {
      if (liked) await api.delete(`/api/reels/${reel.id}/like`);
      else await api.post(`/api/reels/${reel.id}/like`);
    } catch {
      setLiked((v) => !v);
      setLikeCount((c) => c + (liked ? 1 : -1));
    }
  }

  return (
    <div style={{ position: "relative", scrollSnapAlign: "start", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
      <video
        ref={videoRef}
        src={api.mediaUrl(reel.videoUrl)}
        poster={reel.thumbnailUrl ? api.mediaUrl(reel.thumbnailUrl) : undefined}
        loop={false}
        playsInline
        muted={false}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onClick={() => {
          const v = videoRef.current;
          if (v.paused) v.play(); else v.pause();
        }}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />

      {/* Overlaid metadata, the standard short-form layout */}
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <img className="avatar" style={{ width: 30, height: 30 }}
            src={api.mediaUrl(reel.author.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${reel.author.username}`} alt="" />
          <span style={{ fontWeight: 600, fontSize: 13 }}>@{reel.author.username}</span>
        </div>
        {reel.caption && <div style={{ fontSize: 13, marginBottom: 6 }}>{reel.caption}</div>}
        {reel.hashtags?.length > 0 && (
          <div style={{ fontSize: 12, color: "var(--cyan-300)", marginBottom: 6 }}>
            {reel.hashtags.map((t) => `#${t}`).join(" ")}
          </div>
        )}
        <div style={{ fontSize: 11, color: "var(--slate-300)" }}>
          🎵 {reel.isOriginalAudio ? `Original audio · @${reel.author.username}` : (reel.soundName || "Added audio")}
        </div>
      </div>

      {/* Action rail */}
      <div style={{ position: "absolute", right: 12, bottom: 100, display: "flex", flexDirection: "column", gap: 16, alignItems: "center" }}>
        <button onClick={toggleLike} style={{ color: liked ? "var(--cyan-400)" : "#fff", fontSize: 22 }}>
          ♥<div style={{ fontSize: 11 }}>{likeCount}</div>
        </button>
        <div style={{ color: "#fff", fontSize: 20, textAlign: "center" }}>
          💬<div style={{ fontSize: 11 }}>{reel.commentCount}</div>
        </div>
        <div style={{ color: "#fff", fontSize: 20, textAlign: "center" }}>
          👁<div style={{ fontSize: 11 }}>{reel.viewCount}</div>
        </div>
        {reel.discovery && (
          <button onClick={() => setShowStats((s) => !s)} style={{ color: "var(--slate-300)", fontSize: 16 }}>ⓘ</button>
        )}
      </div>

      {showStats && reel.discovery && (
        <div style={{ position: "absolute", right: 12, bottom: 260, width: 190, background: "rgba(6,15,28,0.95)", border: "1px solid var(--line)", borderRadius: 10, padding: 10, fontSize: 11 }}>
          <div className="eyebrow" style={{ fontSize: 9, marginBottom: 6 }}>Why this reached people</div>
          <div>Watched to end: <strong>{reel.discovery.completionRate}%</strong></div>
          <div>Replayed: <strong>{reel.discovery.replayRate}%</strong></div>
          <div>New (non-follower) viewers: <strong>{reel.discovery.newAudienceRate}%</strong></div>
          <p style={{ color: "var(--slate-400)", marginTop: 6, marginBottom: 0, lineHeight: 1.4 }}>
            Reels rank on whether people watch to the end, not on follower count.
          </p>
        </div>
      )}
    </div>
  );
}

// --- Main page -----------------------------------------------------------
export default function Reels() {
  const { user } = useAuth();
  const [reels, setReels] = useState(null);
  const [trending, setTrending] = useState([]);
  const [activeTag, setActiveTag] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [mode, setMode] = useState("feed"); // feed | record | edit | publish
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [edited, setEdited] = useState(null);
  const [caption, setCaption] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const containerRef = useRef(null);
  const recordVideoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [streamReady, setStreamReady] = useState(false);

  async function loadFeed(tag = "") {
    const { reels } = await api.get(`/api/reels/discover${tag ? `?hashtag=${encodeURIComponent(tag)}` : ""}`);
    setReels(reels);
  }

  useEffect(() => {
    loadFeed();
    api.get("/api/reels/hashtags/trending").then(({ trending }) => setTrending(trending)).catch(() => {});
  }, []);

  // Track which reel is on screen so only that one plays.
  function onScroll() {
    const el = containerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollTop / el.clientHeight);
    if (idx !== activeIndex) setActiveIndex(idx);
  }

  // --- Recording ---
  async function startCamera() {
    setMode("record");
    setStreamReady(false);
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });
      streamRef.current = stream;
      if (recordVideoRef.current) {
        recordVideoRef.current.srcObject = stream;
        recordVideoRef.current.muted = true;
        recordVideoRef.current.play();
      }
      setStreamReady(true);
    } catch {
      setError("Camera access was blocked. Allow camera and microphone permissions to record a reel.");
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreamReady(false);
  }

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const candidates = ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"];
    const supported = candidates.find((t) => MediaRecorder.isTypeSupported(t));
    let recorder;
    try {
      recorder = supported
        ? new MediaRecorder(streamRef.current, { mimeType: supported })
        : new MediaRecorder(streamRef.current);
    } catch {
      setError("This browser doesn't support in-browser recording. Try Chrome, Firefox, or a recent Safari.");
      return;
    }
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      setRecordedBlob(blob);
      stopCamera();
      setMode("edit");
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_REEL_SECONDS) stopRecording();
        return s + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setRecording(false);
  }

  function onFilePicked(e) {
    const file = e.target.files[0];
    if (!file) return;
    setRecordedBlob(file);
    setMode("edit");
  }

  async function publish() {
    if (!edited) return;
    setPublishing(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("video", edited.videoBlob, `reel-${Date.now()}.webm`);
      if (edited.thumbnailBlob) fd.append("thumbnail", edited.thumbnailBlob, `thumb-${Date.now()}.jpg`);
      fd.append("caption", caption);
      fd.append("durationSec", String(edited.durationSec));
      fd.append("colorGrade", edited.colorGrade || "");
      fd.append("isOriginalAudio", String(edited.isOriginalAudio));
      if (edited.soundName) fd.append("soundName", edited.soundName);

      await api.upload("/api/reels", fd);
      setMode("feed");
      setRecordedBlob(null);
      setEdited(null);
      setCaption("");
      await loadFeed(activeTag);
    } catch (err) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  }

  useEffect(() => () => { stopCamera(); clearInterval(timerRef.current); }, []);

  // --- Render ---
  if (mode === "record") {
    return (
      <div className="container" style={{ maxWidth: 480, paddingTop: 20, paddingBottom: 40 }}>
        <h1 className="h-display" style={{ fontSize: 20, marginBottom: 10 }}>Record a reel</h1>
        {error && <div className="card" style={{ padding: 12, color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <video ref={recordVideoRef} playsInline
          style={{ width: "100%", aspectRatio: "9/16", objectFit: "cover", borderRadius: 12, background: "#000" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: recording ? "var(--danger)" : "var(--slate-400)" }}>
            {recording ? `● REC ${seconds}s / ${MAX_REEL_SECONDS}s` : streamReady ? "Ready" : "Starting camera…"}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => { stopCamera(); setMode("feed"); }}>Cancel</button>
            {!recording
              ? <button className="btn btn-primary" onClick={startRecording} disabled={!streamReady}>Start</button>
              : <button className="btn btn-primary" onClick={stopRecording}>Stop</button>}
          </div>
        </div>
      </div>
    );
  }

  if (mode === "edit" && recordedBlob) {
    return (
      <div className="container" style={{ maxWidth: 720, paddingTop: 20, paddingBottom: 40 }}>
        <ReelEditor
          sourceBlob={recordedBlob}
          onCancel={() => { setRecordedBlob(null); setMode("feed"); }}
          onExported={(result) => { setEdited(result); setMode("publish"); }}
        />
      </div>
    );
  }

  if (mode === "publish" && edited) {
    return (
      <div className="container" style={{ maxWidth: 480, paddingTop: 20, paddingBottom: 40 }}>
        <h1 className="h-display" style={{ fontSize: 20, marginBottom: 10 }}>Publish</h1>
        {error && <div className="card" style={{ padding: 12, color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <video src={URL.createObjectURL(edited.videoBlob)} controls
          style={{ width: "100%", borderRadius: 12, background: "#000", maxHeight: 420 }} />
        <div className="card" style={{ padding: 14, marginTop: 12, display: "grid", gap: 10 }}>
          <textarea rows={3} value={caption} onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption. Add #hashtags — they're how people find this." />
          {trending.length > 0 && (
            <div>
              <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Trending tags — tap to add</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {trending.slice(0, 10).map((t) => (
                  <button key={t.tag} type="button" className="btn"
                    onClick={() => setCaption((c) => `${c} #${t.tag}`.trim())}
                    style={{ fontSize: 11, padding: "5px 9px", background: "var(--navy-800)", color: "var(--cyan-300)", border: "1px solid var(--line)" }}>
                    #{t.tag}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--slate-400)" }}>
            {edited.durationSec.toFixed(1)}s · {COLOR_GRADES[edited.colorGrade]?.label || "No"} grade ·{" "}
            {edited.isOriginalAudio ? "Original audio" : edited.soundName}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-ghost" onClick={() => setMode("edit")}>Back to edit</button>
            <button className="btn btn-primary" onClick={publish} disabled={publishing}>
              {publishing ? "Publishing…" : "Publish reel"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Feed mode
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 64px)" }}>
      <div className="container" style={{ maxWidth: 640, paddingTop: 12, paddingBottom: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <h1 className="h-display" style={{ fontSize: 20, margin: 0 }}>Reels</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <label className="btn btn-ghost" style={{ fontSize: 12 }}>
              Upload
              <input type="file" accept="video/*" onChange={onFilePicked} style={{ display: "none" }} />
            </label>
            <button className="btn btn-primary" onClick={startCamera} style={{ fontSize: 12 }}>● Record</button>
          </div>
        </div>

        {trending.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 10, overflowX: "auto", paddingBottom: 4 }}>
            <button className="btn" onClick={() => { setActiveTag(""); loadFeed(""); }}
              style={{ fontSize: 11, padding: "5px 10px", whiteSpace: "nowrap", background: !activeTag ? "var(--cyan-400)" : "var(--navy-800)", color: !activeTag ? "var(--navy-950)" : "var(--slate-300)", border: "1px solid var(--line)" }}>
              For you
            </button>
            {trending.map((t) => (
              <button key={t.tag} className="btn" onClick={() => { setActiveTag(t.tag); loadFeed(t.tag); }}
                style={{ fontSize: 11, padding: "5px 10px", whiteSpace: "nowrap", background: activeTag === t.tag ? "var(--cyan-400)" : "var(--navy-800)", color: activeTag === t.tag ? "var(--navy-950)" : "var(--slate-300)", border: "1px solid var(--line)" }}>
                #{t.tag} <span style={{ opacity: 0.6 }}>{t.reelCount}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {reels === null && <p style={{ color: "var(--slate-400)", textAlign: "center", padding: 30 }}>Loading reels…</p>}
      {reels?.length === 0 && (
        <div className="container" style={{ maxWidth: 480 }}>
          <div className="card" style={{ padding: 28, textAlign: "center", color: "var(--slate-400)" }}>
            No reels yet. Record the first one — reels reach people who don't follow you yet, so it's the fastest way to grow.
          </div>
        </div>
      )}

      {reels?.length > 0 && (
        <div
          ref={containerRef}
          onScroll={onScroll}
          style={{
            flex: 1, overflowY: "auto", scrollSnapType: "y mandatory",
            maxWidth: 460, width: "100%", margin: "0 auto", borderRadius: 12,
          }}
        >
          {reels.map((reel, i) => (
            <div key={reel.id} style={{ height: "100%", scrollSnapAlign: "start" }}>
              <ReelCard reel={reel} isActive={i === activeIndex} onViewTracked={() => {}} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
