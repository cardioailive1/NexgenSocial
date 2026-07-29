import { useEffect, useRef, useState } from "react";
import { api } from "../api";

const MAX_SECONDS = 60;

// Records directly in the browser tab (getUserMedia + MediaRecorder) and
// uploads the instant it's stopped -- no switching to a camera app, no
// waiting on a separate "attach file" step. This is the fast path; picking
// an existing video file from disk still works too (see the label below).
export default function QuickVideoRecorder({ onPosted }) {
  const [open, setOpen] = useState(false);
  const [streamReady, setStreamReady] = useState(false); // tracks readiness in STATE, not just the ref, so the UI actually re-renders once the camera is ready
  const [includeAudio, setIncludeAudio] = useState(true);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [previewBlob, setPreviewBlob] = useState(null);
  const [error, setError] = useState("");
  const [posting, setPosting] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  async function openRecorder() {
    setError("");
    setOpen(true);
    setStreamReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: includeAudio });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.play();
      }
      setStreamReady(true); // <-- this is what actually unlocks the Start button now
    } catch {
      setError("Camera access was blocked. Allow camera and microphone access, or attach a video file instead.");
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreamReady(false);
  }

  function closeRecorder() {
    stopStream();
    clearInterval(timerRef.current);
    setOpen(false);
    setRecording(false);
    setSeconds(0);
    setPreviewBlob(null);
    setError("");
  }

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      setPreviewBlob(blob);
      stopStream();
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stopRecording();
        return s + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setRecording(false);
  }

  async function postNow() {
    if (!previewBlob) return;
    setPosting(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("media", previewBlob, `quick-video-${Date.now()}.webm`);
      await api.upload("/api/posts", formData);
      closeRecorder();
      onPosted?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  useEffect(() => () => { stopStream(); clearInterval(timerRef.current); }, []);

  if (!open) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <button type="button" className="btn btn-primary" onClick={openRecorder} style={{ fontSize: 13 }}>
          ● Record video
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--slate-400)" }}>
          <input type="checkbox" checked={includeAudio} onChange={(e) => setIncludeAudio(e.target.checked)} />
          Include microphone audio
        </label>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 14, marginTop: 10 }}>
      {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 8 }}>{error}</div>}

      {!previewBlob && (
        <>
          <video ref={videoRef} style={{ width: "100%", borderRadius: 10, background: "#000", maxHeight: 360, objectFit: "cover" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: recording ? "var(--danger)" : "var(--slate-400)" }}>
              {recording
                ? `● REC ${seconds}s / ${MAX_SECONDS}s`
                : streamReady
                  ? `Ready — recording ${includeAudio ? "video + audio" : "video only (muted)"}`
                  : "Requesting camera access…"}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={closeRecorder}>Cancel</button>
              {!recording ? (
                <button type="button" className="btn btn-primary" onClick={startRecording} disabled={!streamReady}>Start</button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={stopRecording}>Stop</button>
              )}
            </div>
          </div>
        </>
      )}

      {previewBlob && (
        <>
          <video src={URL.createObjectURL(previewBlob)} controls style={{ width: "100%", borderRadius: 10, maxHeight: 360 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
            <button type="button" className="btn btn-ghost" onClick={() => { setPreviewBlob(null); openRecorder(); }}>Retake</button>
            <button type="button" className="btn btn-primary" onClick={postNow} disabled={posting}>
              {posting ? "Posting…" : "Post now"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
