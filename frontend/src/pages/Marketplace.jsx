import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

function MediaGallery({ media, coverUrl }) {
  const [index, setIndex] = useState(0);
  const items = media?.length ? media : coverUrl ? [{ id: "legacy", url: coverUrl, kind: "PHOTO" }] : [];
  if (items.length === 0) {
    return (
      <div style={{ width: "100%", aspectRatio: "4/3", background: "var(--navy-800)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--slate-400)", fontSize: 12 }}>
        No photos
      </div>
    );
  }

  const current = items[Math.min(index, items.length - 1)];
  return (
    <div>
      <div style={{ position: "relative" }}>
        {current.kind === "VIDEO" ? (
          <video src={api.mediaUrl(current.url)} controls
            style={{
              display: "block", maxWidth: "100%", maxHeight: 420,
              width: "auto", height: "auto", margin: "0 auto",
              borderRadius: 10, background: "#000",
            }} />
        ) : (
          <img src={api.mediaUrl(current.url)} alt=""
            // Sizes to the photo's own aspect ratio. A forced 4:3 box meant
            // a portrait item photo sat inside heavy black bars.
            style={{
              display: "block", maxWidth: "100%", maxHeight: 420,
              width: "auto", height: "auto", margin: "0 auto",
              borderRadius: 10,
            }} />
        )}
        {items.length > 1 && (
          <div style={{ position: "absolute", top: 8, right: 8, background: "rgba(6,15,28,0.85)", borderRadius: 999, padding: "3px 9px", fontSize: 11, color: "var(--slate-300)" }}>
            {index + 1} / {items.length}
          </div>
        )}
      </div>
      {items.length > 1 && (
        <div style={{ display: "flex", gap: 6, marginTop: 6, overflowX: "auto" }}>
          {items.map((m, i) => (
            <button key={m.id} type="button" onClick={() => setIndex(i)}
              style={{
                flexShrink: 0, width: 54, height: 54, borderRadius: 8, overflow: "hidden",
                border: i === index ? "2px solid var(--cyan-400)" : "1px solid var(--line)",
                background: "var(--navy-800)", position: "relative", padding: 0,
              }}>
              {m.kind === "VIDEO" ? (
                <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>▶</div>
              ) : (
                <img src={api.mediaUrl(m.url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Marketplace() {
  const { user } = useAuth();
  const [listings, setListings] = useState(null);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", price: "", condition: "", location: "" });
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef();

  async function load(q = "") {
    setError("");
    try {
      const { listings } = await api.get(`/api/marketplace${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setListings(listings);
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setTimeout(() => load(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  function onFilesPicked(e) {
    const picked = Array.from(e.target.files || []).slice(0, 10);
    setFiles(picked);
    setPreviews(picked.map((f) => ({
      name: f.name,
      url: URL.createObjectURL(f),
      isVideo: f.type.startsWith("video"),
    })));
  }

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function createListing(e) {
    e.preventDefault();
    if (!form.title || !form.description || form.price === "") {
      setError("Title, description, and price are required.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("title", form.title);
      fd.append("description", form.description);
      fd.append("priceCents", String(Math.round(parseFloat(form.price) * 100)));
      if (form.condition) fd.append("condition", form.condition);
      if (form.location) fd.append("location", form.location);
      files.forEach((f) => fd.append("media", f));

      await api.upload("/api/marketplace", fd);
      setForm({ title: "", description: "", price: "", condition: "", location: "" });
      setFiles([]);
      setPreviews([]);
      if (fileRef.current) fileRef.current.value = "";
      setShowForm(false);
      await load(query);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function markSold(id) {
    await api.patch(`/api/marketplace/${id}`, { status: "SOLD" });
    load(query);
  }

  return (
    <div className="container" style={{ maxWidth: 700, paddingTop: 28, paddingBottom: 60 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
        <h1 className="h-display" style={{ fontSize: 22, margin: 0 }}>Marketplace</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Sell something"}
        </button>
      </div>

      <input type="text" placeholder="Search listings…" value={query} onChange={(e) => setQuery(e.target.value)} style={{ marginBottom: 16 }} />

      {error && <div className="card" style={{ padding: 12, color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {showForm && (
        <form onSubmit={createListing} className="card" style={{ padding: 16, marginBottom: 20, display: "grid", gap: 10 }}>
          <h2 className="eyebrow">New listing</h2>
          <input type="text" placeholder="What are you selling?" value={form.title} onChange={set("title")} />
          <textarea rows={3} placeholder="Describe it — condition, details, why you're selling" value={form.description} onChange={set("description")} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="text" placeholder="Price (USD)" value={form.price} onChange={set("price")} style={{ flex: 1, minWidth: 110 }} />
            <input type="text" placeholder="Condition (e.g. Like new)" value={form.condition} onChange={set("condition")} style={{ flex: 1, minWidth: 130 }} />
          </div>
          <input type="text" placeholder="Location (e.g. Columbus, OH)" value={form.location} onChange={set("location")} />

          <div>
            <label className="btn btn-ghost" style={{ fontSize: 13 }}>
              📷 Add photos & video (up to 10)
              <input ref={fileRef} type="file" accept="image/*,video/*" multiple onChange={onFilesPicked} style={{ display: "none" }} />
            </label>
            {previews.length > 0 && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                {previews.map((p, i) => (
                  <div key={i} style={{ width: 64, height: 64, borderRadius: 8, overflow: "hidden", border: "1px solid var(--line)", position: "relative" }}>
                    {p.isVideo
                      ? <video src={p.url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    {p.isVideo && (
                      <div style={{ position: "absolute", bottom: 2, right: 4, fontSize: 11 }}>▶</div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 6 }}>
              The first photo becomes the cover image. Listings with several photos and a short video get far more interest.
            </p>
          </div>

          <button className="btn btn-primary" type="submit" disabled={creating} style={{ justifySelf: "start" }}>
            {creating ? "Publishing…" : "Publish listing"}
          </button>
        </form>
      )}

      {listings === null && <p style={{ color: "var(--slate-400)" }}>Loading…</p>}
      {listings?.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--slate-400)", fontSize: 13 }}>
          {query ? "Nothing matches that search." : "No listings yet — be the first to sell something."}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {listings?.map((l) => (
          <div key={l.id} className="card" style={{ padding: 12 }}>
            <MediaGallery media={l.media} coverUrl={l.coverUrl} />
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{l.title}</div>
                <div className="h-display" style={{ fontSize: 16, color: "var(--cyan-300)" }}>${(l.priceCents / 100).toFixed(2)}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--slate-400)", marginTop: 4 }}>{l.description}</div>
              <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                {l.condition && <span>{l.condition}</span>}
                {l.location && <span>· {l.location}</span>}
                {(l.photoCount > 0 || l.videoCount > 0) && (
                  <span>· {l.photoCount} photo{l.photoCount === 1 ? "" : "s"}{l.videoCount ? `, ${l.videoCount} video` : ""}</span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 6 }}>
                Seller: @{l.seller.username}
              </div>
              {l.seller.username === user?.username && (
                <button className="btn btn-ghost" onClick={() => markSold(l.id)} style={{ fontSize: 11, padding: "5px 9px", marginTop: 8 }}>
                  Mark as sold
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
