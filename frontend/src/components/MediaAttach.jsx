import { useRef, useState } from "react";
import { api } from "../api";

// Shared file picker with previews, used anywhere photos/videos can be
// attached. Returns the chosen File objects to the parent, which appends
// them to its own FormData -- keeps this component agnostic of endpoints.
export function MediaPicker({ files, onChange, max = 10, label = "📷 Add photos & videos" }) {
  const inputRef = useRef();

  function pick(e) {
    const chosen = Array.from(e.target.files || []).slice(0, max);
    onChange(chosen);
  }

  function removeAt(i) {
    const next = files.filter((_, idx) => idx !== i);
    onChange(next);
    // Clearing the input lets the same file be re-picked after removal,
    // which otherwise silently does nothing.
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <label className="btn btn-ghost" style={{ fontSize: 13 }}>
        {label}
        <input ref={inputRef} type="file" accept="image/*,video/*" multiple onChange={pick} style={{ display: "none" }} />
      </label>
      {files.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {files.map((f, i) => {
            const url = URL.createObjectURL(f);
            const isVideo = f.type.startsWith("video");
            return (
              <div key={i} style={{ position: "relative", width: 68, height: 68, borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)" }}>
                {isVideo
                  ? <video src={url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                {isVideo && <div style={{ position: "absolute", bottom: 2, left: 4, fontSize: 11 }}>▶</div>}
                <button type="button" onClick={() => removeAt(i)}
                  style={{ position: "absolute", top: 2, right: 2, background: "rgba(6,15,28,0.85)", borderRadius: "50%", width: 18, height: 18, color: "var(--danger)", fontSize: 13, lineHeight: 1 }}>
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
      {files.length > 0 && (
        <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 6 }}>
          {files.length} file{files.length === 1 ? "" : "s"} attached (max {max})
        </div>
      )}
    </div>
  );
}

// Displays saved media with a gallery and per-item download links.
export function MediaGallery({ media, legacyUrl, compact = false }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(null);
  const items = media?.length
    ? [...media].sort((a, b) => a.position - b.position)
    : legacyUrl
      ? [{ id: "legacy", url: legacyUrl, kind: "PHOTO" }]
      : [];

  if (items.length === 0) return null;
  const current = items[Math.min(index, items.length - 1)];
  const maxH = compact ? 260 : 420;

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ position: "relative" }}>
        {current.kind === "VIDEO" ? (
          <video src={api.mediaUrl(current.url)} controls
            style={{ width: "100%", borderRadius: 10, background: "#000", maxHeight: maxH, objectFit: "contain", border: "1px solid var(--line)" }} />
        ) : (
          <img
            src={api.mediaUrl(current.url)}
            alt={current.caption || ""}
            onClick={() => setLightbox(current)}
            style={{
              width: "100%", borderRadius: 10, maxHeight: maxH,
              // "contain" not "cover": cover crops anything whose aspect
              // ratio doesn't match the box, which chopped the top and
              // bottom off portrait photos. contain scales the whole image
              // to fit, so nothing is lost.
              objectFit: "contain",
              // A dark backdrop so letterboxing reads as intentional
              // rather than looking like a rendering fault.
              background: "var(--navy-950)",
              border: "1px solid var(--line)",
              cursor: "zoom-in",
              display: "block",
            }}
          />
        )}
        {items.length > 1 && (
          <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(6,15,28,0.85)", borderRadius: 999, padding: "3px 9px", fontSize: 11, color: "var(--slate-300)" }}>
            {index + 1} / {items.length}
          </div>
        )}
      </div>

      {current.caption && (
        <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 4, fontStyle: "italic" }}>{current.caption}</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        {items.length > 1 ? (
          <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
            {items.map((m, i) => (
              <button key={m.id} type="button" onClick={() => setIndex(i)}
                style={{
                  flexShrink: 0, width: 46, height: 46, borderRadius: 6, overflow: "hidden", padding: 0,
                  border: i === index ? "2px solid var(--cyan-400)" : "1px solid var(--line)",
                  background: "var(--navy-800)",
                }}>
                {m.kind === "VIDEO"
                  ? <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>▶</div>
                  : <img src={api.mediaUrl(m.url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
              </button>
            ))}
          </div>
        ) : <span />}

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {current.kind !== "VIDEO" && (
            <button type="button" onClick={() => setLightbox(current)}
              style={{ fontSize: 11, color: "var(--cyan-300)", whiteSpace: "nowrap" }}>
              ⛶ View full size
            </button>
          )}
          {/* Explicit download link -- viewing in-page and saving a copy are
              different needs, especially for press images and ad creative. */}
          <a href={api.mediaUrl(current.url)} download target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 11, color: "var(--cyan-300)", whiteSpace: "nowrap" }}>
            ⤓ Download {current.kind === "VIDEO" ? "video" : "photo"}
          </a>
        </div>
      </div>

      {/* Full-size overlay. The inline view is deliberately height-capped so
          one tall photo doesn't push everything else off screen; this is
          how you see the whole thing at full resolution. */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed", inset: 0, zIndex: 200,
            background: "rgba(3, 8, 15, 0.94)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 20, cursor: "zoom-out",
          }}
        >
          <img
            src={api.mediaUrl(lightbox.url)}
            alt={lightbox.caption || ""}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", borderRadius: 8, cursor: "default" }}
          />
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: "absolute", top: 16, right: 20, fontSize: 26,
              color: "var(--white)", lineHeight: 1,
            }}
            aria-label="Close"
          >
            ×
          </button>
          {lightbox.caption && (
            <div style={{
              position: "absolute", bottom: 20, left: 0, right: 0, textAlign: "center",
              fontSize: 12, color: "var(--slate-300)", padding: "0 20px",
            }}>
              {lightbox.caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
