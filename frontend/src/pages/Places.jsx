import { useEffect, useState } from "react";
import { api } from "../api";

// Deliberately NOT background location tracking. Each place is added by an
// intentional action -- either searching for it or capturing the current
// position once, on tap. Passive continuous tracking would be far more
// invasive, much harder to justify legally (GDPR/CCPA), and isn't needed
// for the "places I've visited" feature people actually want.
export default function Places() {
  const [places, setPlaces] = useState(null);
  const [form, setForm] = useState({ name: "", address: "", latitude: "", longitude: "", note: "", isPublic: false });
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    const { places } = await api.get("/api/profile/me/places");
    setPlaces(places);
  }
  useEffect(() => { load(); }, []);

  function useCurrentLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError("This browser doesn't support location access.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      (err) => {
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. You can still enter coordinates or an address manually."
            : "Couldn't get your location. Try again, or enter it manually."
        );
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function addPlace(e) {
    e.preventDefault();
    if (!form.name || !form.latitude || !form.longitude) {
      setError("A place needs at least a name and coordinates.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.post("/api/profile/me/places", form);
      setForm({ name: "", address: "", latitude: "", longitude: "", note: "", isPublic: false });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function removePlace(id) {
    await api.delete(`/api/profile/me/places/${id}`);
    load();
  }

  function set(field) {
    return (e) => {
      const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      setForm((f) => ({ ...f, [field]: value }));
    };
  }

  // Both providers get a link per place. These are plain public URL schemes
  // -- no API key, no SDK, no billing account required, and they open in
  // whichever app the person actually prefers. An embedded interactive map
  // would need a Google Cloud key (and MapKit JS needs an Apple Developer
  // account + signed tokens); see the note at the bottom of this page.
  function googleMapsUrl(p) {
    return p.googlePlaceId
      ? `https://www.google.com/maps/place/?q=place_id:${p.googlePlaceId}`
      : `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;
  }
  function appleMapsUrl(p) {
    return `https://maps.apple.com/?ll=${p.latitude},${p.longitude}&q=${encodeURIComponent(p.name)}`;
  }

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Places I've visited</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 20 }}>
        Save places you've been. Nothing is tracked in the background — places
        only get added when you add them. Each one is private unless you mark
        it public.
      </p>

      {error && <div className="card" style={{ padding: 14, color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <form onSubmit={addPlace} className="card" style={{ padding: 16, marginBottom: 20, display: "grid", gap: 10 }}>
        <h2 className="eyebrow">Add a place</h2>
        <input type="text" placeholder="Place name (e.g. Blue Bottle Coffee)" value={form.name} onChange={set("name")} />
        <input type="text" placeholder="Address (optional)" value={form.address} onChange={set("address")} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="text" placeholder="Latitude" value={form.latitude} onChange={set("latitude")} style={{ flex: 1, minWidth: 110 }} />
          <input type="text" placeholder="Longitude" value={form.longitude} onChange={set("longitude")} style={{ flex: 1, minWidth: 110 }} />
        </div>
        <button type="button" className="btn btn-ghost" onClick={useCurrentLocation} disabled={locating} style={{ justifySelf: "start" }}>
          {locating ? "Getting location…" : "📍 Use my current location"}
        </button>
        <input type="text" placeholder="Note (optional)" value={form.note} onChange={set("note")} />
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate-300)" }}>
          <input type="checkbox" checked={form.isPublic} onChange={set("isPublic")} />
          Show this place on my public profile
        </label>
        <button className="btn btn-primary" type="submit" disabled={saving} style={{ justifySelf: "start" }}>
          {saving ? "Saving…" : "Add place"}
        </button>
      </form>

      <h2 className="eyebrow" style={{ marginBottom: 10 }}>Saved places ({places?.length ?? 0})</h2>
      {places === null && <p style={{ color: "var(--slate-400)" }}>Loading…</p>}
      {places?.length === 0 && <p style={{ color: "var(--slate-400)", fontSize: 13 }}>No places saved yet.</p>}
      {places?.map((p) => (
        <div key={p.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                {p.name} {p.isPublic && <span className="premium-pill" style={{ marginLeft: 6 }}>Public</span>}
              </div>
              {p.address && <div style={{ fontSize: 12, color: "var(--slate-400)" }}>{p.address}</div>}
              {p.note && <div style={{ fontSize: 12, color: "var(--slate-300)", marginTop: 4 }}>{p.note}</div>}
              <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 4 }}>
                {new Date(p.visitedAt).toLocaleDateString()} · {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <a href={googleMapsUrl(p)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--cyan-300)" }}>Google Maps ↗</a>
                <a href={appleMapsUrl(p)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--cyan-300)" }}>Apple Maps ↗</a>
              </div>
            </div>
            <button className="btn btn-ghost btn-danger" onClick={() => removePlace(p.id)} style={{ fontSize: 11, padding: "6px 10px" }}>Remove</button>
          </div>
        </div>
      ))}

      <p style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 20, lineHeight: 1.5 }}>
        Each place links out to both Google Maps and Apple Maps using their
        public URL schemes — no API keys needed, and it opens in whichever app
        you prefer. Embedding an interactive map inline would require a Google
        Cloud API key (billable) or an Apple Developer account with MapKit JS
        tokens; see the README for how to add either once you have credentials.
      </p>
    </div>
  );
}
