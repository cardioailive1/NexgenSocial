import { useEffect, useRef, useState } from "react";

// Color grades are CSS filter strings. They're applied live to the preview
// <video> for instant feedback, and then re-applied to the canvas context
// during export so what you see is actually what gets burned in.
export const COLOR_GRADES = {
  none:      { label: "None",      filter: "none" },
  warm:      { label: "Warm",      filter: "saturate(1.3) sepia(0.2) contrast(1.05) brightness(1.05)" },
  cool:      { label: "Cool",      filter: "saturate(1.1) hue-rotate(-15deg) contrast(1.1) brightness(1.02)" },
  vivid:     { label: "Vivid",     filter: "saturate(1.7) contrast(1.2)" },
  noir:      { label: "Noir",      filter: "grayscale(1) contrast(1.35)" },
  fade:      { label: "Fade",      filter: "saturate(0.75) contrast(0.9) brightness(1.1)" },
  vintage:   { label: "Vintage",   filter: "sepia(0.45) saturate(1.2) contrast(1.1)" },
  dramatic:  { label: "Dramatic",  filter: "contrast(1.5) saturate(0.85) brightness(0.95)" },
};

const FONT_OPTIONS = [
  { label: "Bold", value: "700 42px Inter, system-ui, sans-serif" },
  { label: "Display", value: "700 46px 'Space Grotesk', system-ui, sans-serif" },
  { label: "Mono", value: "500 36px 'IBM Plex Mono', monospace" },
];

export default function ReelEditor({ sourceBlob, onExported, onCancel }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const audioRef = useRef(null);

  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [grade, setGrade] = useState("none");
  const [overlays, setOverlays] = useState([]); // {id, text, x, y, font, color, startSec, endSec}
  const [newText, setNewText] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [audioName, setAudioName] = useState("");
  const [keepOriginalAudio, setKeepOriginalAudio] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [previewTime, setPreviewTime] = useState(0);

  const sourceUrl = useRef(null);
  if (!sourceUrl.current && sourceBlob) sourceUrl.current = URL.createObjectURL(sourceBlob);

  useEffect(() => {
    return () => { if (sourceUrl.current) URL.revokeObjectURL(sourceUrl.current); };
  }, []);

  function onLoadedMetadata() {
    const v = videoRef.current;
    if (!v) return;
    // Some WebM recordings report Infinity for duration until seeked --
    // a known quirk of MediaRecorder output. Seeking forces a real value.
    if (!Number.isFinite(v.duration)) {
      v.currentTime = 1e6;
      v.ontimeupdate = () => {
        v.ontimeupdate = null;
        v.currentTime = 0;
        const d = v.duration;
        setDuration(d);
        setTrimEnd(d);
      };
      return;
    }
    setDuration(v.duration);
    setTrimEnd(v.duration);
  }

  function addOverlay() {
    if (!newText.trim()) return;
    setOverlays((o) => [
      ...o,
      {
        id: Date.now(),
        text: newText,
        x: 0.5,
        y: 0.5,
        font: FONT_OPTIONS[0].value,
        color: "#ffffff",
        startSec: 0,
        endSec: duration || 0,
      },
    ]);
    setNewText("");
  }

  function updateOverlay(id, patch) {
    setOverlays((o) => o.map((ov) => (ov.id === id ? { ...ov, ...patch } : ov)));
  }

  function removeOverlay(id) {
    setOverlays((o) => o.filter((ov) => ov.id !== id));
  }

  function drawFrame(ctx, video, timeSec, w, h) {
    ctx.save();
    ctx.filter = COLOR_GRADES[grade].filter;
    ctx.drawImage(video, 0, 0, w, h);
    ctx.restore();

    // Text overlays are drawn AFTER the filter is reset, so color grading
    // applies to the footage only -- grading the text too would make it
    // muddy and unreadable on strong presets like Noir.
    for (const ov of overlays) {
      if (timeSec < ov.startSec || timeSec > ov.endSec) continue;
      ctx.save();
      ctx.font = ov.font;
      ctx.fillStyle = ov.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.65)";
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 2;
      ctx.fillText(ov.text, ov.x * w, ov.y * h);
      ctx.restore();
    }
  }

  // Live preview loop so the canvas shows exactly what will be exported.
  useEffect(() => {
    let raf;
    function loop() {
      const v = videoRef.current;
      const c = canvasRef.current;
      if (v && c && v.readyState >= 2) {
        const ctx = c.getContext("2d");
        if (c.width !== v.videoWidth && v.videoWidth) {
          c.width = v.videoWidth;
          c.height = v.videoHeight;
        }
        drawFrame(ctx, v, v.currentTime, c.width, c.height);
        setPreviewTime(v.currentTime);
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [grade, overlays]);

  // --- Export --------------------------------------------------------------
  // Re-encodes by playing the trimmed range in real time while capturing the
  // canvas. This is the only approach that works in-browser without shipping
  // ffmpeg.wasm (~30MB). The tradeoff is honest and worth knowing: export
  // takes about as long as the clip itself, because it genuinely plays it
  // through once.
  async function exportReel() {
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;

    setExporting(true);
    setError("");
    setProgress(0);

    try {
      const canvasStream = c.captureStream(30);

      // Audio: either the original recording's track, an uploaded track, or
      // neither. Web Audio lets us route whichever into the recorded stream.
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      let hasAudio = false;

      if (keepOriginalAudio) {
        try {
          const srcNode = audioCtx.createMediaElementSource(v);
          srcNode.connect(dest);
          srcNode.connect(audioCtx.destination);
          hasAudio = true;
        } catch {
          // Already connected on a previous export attempt -- non-fatal.
        }
      }

      if (audioFile && audioRef.current) {
        try {
          const musicNode = audioCtx.createMediaElementSource(audioRef.current);
          const gain = audioCtx.createGain();
          // Duck the music if original audio is also present, so speech
          // stays intelligible rather than being buried.
          gain.gain.value = keepOriginalAudio ? 0.35 : 1.0;
          musicNode.connect(gain);
          gain.connect(dest);
          hasAudio = true;
        } catch {
          // ignore double-connect
        }
      }

      const tracks = [...canvasStream.getVideoTracks()];
      if (hasAudio) tracks.push(...dest.stream.getAudioTracks());
      const mixed = new MediaStream(tracks);

      const candidates = ["video/webm;codecs=vp9,opus", "video/webm", "video/mp4"];
      const mimeType = candidates.find((t) => MediaRecorder.isTypeSupported(t));
      const recorder = new MediaRecorder(mixed, mimeType ? { mimeType } : undefined);
      const chunks = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

      const done = new Promise((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
      });

      v.currentTime = trimStart;
      await new Promise((r) => { v.onseeked = r; });

      recorder.start();
      if (audioFile && audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      await v.play();

      const clipLength = trimEnd - trimStart;
      await new Promise((resolve) => {
        function check() {
          const elapsed = v.currentTime - trimStart;
          setProgress(Math.min(100, Math.round((elapsed / clipLength) * 100)));
          if (v.currentTime >= trimEnd || v.ended) {
            resolve();
          } else {
            requestAnimationFrame(check);
          }
        }
        check();
      });

      v.pause();
      if (audioRef.current) audioRef.current.pause();
      recorder.stop();

      const blob = await done;
      audioCtx.close();

      // Grab a thumbnail from the middle of the clip -- a frame from the
      // very first moment is often a blur or a closed shutter.
      v.currentTime = trimStart + clipLength / 2;
      await new Promise((r) => { v.onseeked = r; });
      const thumbCanvas = document.createElement("canvas");
      thumbCanvas.width = c.width;
      thumbCanvas.height = c.height;
      drawFrame(thumbCanvas.getContext("2d"), v, v.currentTime, thumbCanvas.width, thumbCanvas.height);
      const thumbBlob = await new Promise((r) => thumbCanvas.toBlob(r, "image/jpeg", 0.8));

      onExported({
        videoBlob: blob,
        thumbnailBlob: thumbBlob,
        durationSec: clipLength,
        colorGrade: grade,
        soundName: audioName || null,
        isOriginalAudio: !audioFile,
      });
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }

  const gradeFilter = COLOR_GRADES[grade].filter;

  return (
    <div className="card" style={{ padding: 16 }}>
      <h2 className="eyebrow" style={{ marginBottom: 12 }}>Edit your reel</h2>

      {error && <div style={{ color: "var(--danger)", fontSize: 13, marginBottom: 10 }}>{error}</div>}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 260px", minWidth: 240 }}>
          {/* The <video> is the decode source; the <canvas> is what the user
              sees and what gets exported, so preview and output can't drift. */}
          <video
            ref={videoRef}
            src={sourceUrl.current}
            onLoadedMetadata={onLoadedMetadata}
            style={{ display: "none" }}
            playsInline
          />
          <canvas
            ref={canvasRef}
            style={{ width: "100%", borderRadius: 10, background: "#000", aspectRatio: "9/16", objectFit: "cover" }}
          />
          {audioFile && <audio ref={audioRef} src={URL.createObjectURL(audioFile)} style={{ display: "none" }} />}

          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }}
              onClick={() => { const v = videoRef.current; v.currentTime = trimStart; v.play(); }}>
              ▶ Preview
            </button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }}
              onClick={() => videoRef.current?.pause()}>
              ⏸ Pause
            </button>
            <span style={{ fontSize: 11, color: "var(--slate-400)", alignSelf: "center", fontFamily: "var(--font-mono)" }}>
              {previewTime.toFixed(1)}s
            </span>
          </div>
        </div>

        <div style={{ flex: "1 1 260px", minWidth: 240, display: "grid", gap: 14, alignContent: "start" }}>
          {/* Trim */}
          <div>
            <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Trim</div>
            <label style={{ fontSize: 11, color: "var(--slate-400)" }}>
              Start: {trimStart.toFixed(1)}s
              <input type="range" min={0} max={duration || 0} step={0.1} value={trimStart}
                onChange={(e) => setTrimStart(Math.min(Number(e.target.value), trimEnd - 0.5))}
                style={{ width: "100%" }} />
            </label>
            <label style={{ fontSize: 11, color: "var(--slate-400)" }}>
              End: {trimEnd.toFixed(1)}s
              <input type="range" min={0} max={duration || 0} step={0.1} value={trimEnd}
                onChange={(e) => setTrimEnd(Math.max(Number(e.target.value), trimStart + 0.5))}
                style={{ width: "100%" }} />
            </label>
            <div style={{ fontSize: 11, color: "var(--cyan-300)" }}>
              Clip length: {(trimEnd - trimStart).toFixed(1)}s
            </div>
          </div>

          {/* Color grading */}
          <div>
            <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Color grade</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {Object.entries(COLOR_GRADES).map(([key, g]) => (
                <button type="button" key={key} onClick={() => setGrade(key)} className="btn"
                  style={{
                    fontSize: 11, padding: "5px 9px",
                    background: grade === key ? "var(--cyan-400)" : "var(--navy-800)",
                    color: grade === key ? "var(--navy-950)" : "var(--slate-300)",
                    border: "1px solid var(--line)",
                  }}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text overlays */}
          <div>
            <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Text on screen</div>
            <div style={{ display: "flex", gap: 6 }}>
              <input type="text" value={newText} onChange={(e) => setNewText(e.target.value)}
                placeholder="Add text…" style={{ fontSize: 12, padding: "7px 10px" }} />
              <button type="button" className="btn btn-primary" onClick={addOverlay} style={{ fontSize: 11, padding: "6px 10px" }}>Add</button>
            </div>
            {overlays.map((ov) => (
              <div key={ov.id} style={{ marginTop: 8, padding: 8, background: "var(--navy-950)", border: "1px solid var(--line)", borderRadius: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                  <input type="text" value={ov.text} onChange={(e) => updateOverlay(ov.id, { text: e.target.value })}
                    style={{ fontSize: 12, padding: "5px 8px" }} />
                  <button type="button" onClick={() => removeOverlay(ov.id)} style={{ color: "var(--danger)", fontSize: 16 }}>×</button>
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={ov.font} onChange={(e) => updateOverlay(ov.id, { font: e.target.value })}
                    style={{ fontSize: 11, padding: "4px 6px", background: "var(--navy-900)", color: "var(--white)", border: "1px solid var(--line)", borderRadius: 6 }}>
                    {FONT_OPTIONS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
                  </select>
                  <input type="color" value={ov.color} onChange={(e) => updateOverlay(ov.id, { color: e.target.value })}
                    style={{ width: 32, height: 26, padding: 0, border: "1px solid var(--line)", borderRadius: 6, background: "none" }} />
                </div>
                <label style={{ fontSize: 10, color: "var(--slate-400)" }}>
                  Vertical position
                  <input type="range" min={0.05} max={0.95} step={0.01} value={ov.y}
                    onChange={(e) => updateOverlay(ov.id, { y: Number(e.target.value) })} style={{ width: "100%" }} />
                </label>
                <label style={{ fontSize: 10, color: "var(--slate-400)" }}>
                  Shows from {ov.startSec.toFixed(1)}s to {ov.endSec.toFixed(1)}s
                  <input type="range" min={0} max={duration || 0} step={0.1} value={ov.startSec}
                    onChange={(e) => updateOverlay(ov.id, { startSec: Math.min(Number(e.target.value), ov.endSec - 0.2) })} style={{ width: "100%" }} />
                  <input type="range" min={0} max={duration || 0} step={0.1} value={ov.endSec}
                    onChange={(e) => updateOverlay(ov.id, { endSec: Math.max(Number(e.target.value), ov.startSec + 0.2) })} style={{ width: "100%" }} />
                </label>
              </div>
            ))}
          </div>

          {/* Audio */}
          <div>
            <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Audio</div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--slate-300)" }}>
              <input type="checkbox" checked={keepOriginalAudio} onChange={(e) => setKeepOriginalAudio(e.target.checked)} />
              Keep original audio
            </label>
            <label className="btn btn-ghost" style={{ fontSize: 11, marginTop: 6, display: "inline-flex" }}>
              🎵 Add a music track
              <input type="file" accept="audio/*" style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files[0];
                  setAudioFile(f || null);
                  setAudioName(f ? f.name.replace(/\.[^.]+$/, "") : "");
                }} />
            </label>
            {audioFile && (
              <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 4 }}>
                {audioName}
                <button type="button" onClick={() => { setAudioFile(null); setAudioName(""); }}
                  style={{ color: "var(--danger)", marginLeft: 6 }}>remove</button>
              </div>
            )}
            <p style={{ fontSize: 10, color: "var(--slate-400)", marginTop: 6, lineHeight: 1.4 }}>
              Use audio you have the rights to. There's no built-in sound
              library — see the README for why (music licensing).
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={exporting}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={exportReel} disabled={exporting || !duration}>
          {exporting ? `Rendering… ${progress}%` : "Apply edits"}
        </button>
        {exporting && (
          <span style={{ fontSize: 11, color: "var(--slate-400)" }}>
            Rendering plays the clip through once, so it takes about as long as the clip itself.
          </span>
        )}
      </div>
    </div>
  );
}
