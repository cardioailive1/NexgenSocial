import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const SECTIONS = [
  { key: "marketplace", label: "Marketplace", desc: "Buy and sell within the community.", status: "live" },
  { key: "business", label: "Business Place", desc: "Storefronts, catalogs, and business ads.", status: "live-ads" },
  { key: "political", label: "Political Place", desc: "Campaign pages, issue groups, political ads.", status: "roadmap" },
  { key: "media", label: "Media Coverage & Live", desc: "Newsroom pages and live broadcasts.", status: "roadmap" },
];

function UpgradeCard({ onUpgrade }) {
  return (
    <div className="card" style={{ padding: 28, textAlign: "center", marginBottom: 24 }}>
      <span className="premium-pill">Premium</span>
      <h1 className="h-display" style={{ fontSize: 24, margin: "12px 0 6px" }}>Unlock the full NexgenSocial suite</h1>
      <p style={{ color: "var(--slate-400)", maxWidth: 440, margin: "0 auto 18px" }}>
        Sell in the marketplace, run ads, and get early access to the political
        and media hubs as they roll out.
      </p>
      <button className="btn btn-primary" onClick={onUpgrade}>Upgrade to Premium</button>
    </div>
  );
}

function Marketplace() {
  const [listings, setListings] = useState(null);
  const [form, setForm] = useState({ title: "", description: "", priceCents: "" });
  const [error, setError] = useState("");

  async function load() {
    const { listings } = await api.get("/api/premium/marketplace");
    setListings(listings);
  }
  useEffect(() => { load(); }, []);

  async function createListing(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/api/premium/marketplace", {
        title: form.title,
        description: form.description,
        priceCents: Math.round(parseFloat(form.priceCents) * 100),
      });
      setForm({ title: "", description: "", priceCents: "" });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <form onSubmit={createListing} className="card" style={{ padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
        <input type="text" placeholder="Item title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <textarea placeholder="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <input type="text" placeholder="Price (USD)" value={form.priceCents} onChange={(e) => setForm({ ...form, priceCents: e.target.value })} />
        {error && <div style={{ color: "var(--danger)", fontSize: 13 }}>{error}</div>}
        <button className="btn btn-primary" type="submit" style={{ justifySelf: "start" }}>List item</button>
      </form>
      {listings?.map((l) => (
        <div key={l.id} className="card" style={{ padding: 16, marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700 }}>{l.title}</div>
            <div style={{ color: "var(--slate-400)", fontSize: 13 }}>{l.description}</div>
          </div>
          <div className="h-display">${(l.priceCents / 100).toFixed(2)}</div>
        </div>
      ))}
      {listings?.length === 0 && <p style={{ color: "var(--slate-400)" }}>No listings yet — be the first to sell something.</p>}
    </div>
  );
}

function AdsPanel({ category }) {
  const [ads, setAds] = useState(null);
  const [form, setForm] = useState({ headline: "", body: "" });

  async function load() {
    const { ads } = await api.get(`/api/premium/ads?category=${category}`);
    setAds(ads);
  }
  useEffect(() => { load(); }, [category]);

  async function createAd(e) {
    e.preventDefault();
    await api.post("/api/premium/ads", { ...form, category });
    setForm({ headline: "", body: "" });
    load();
  }

  return (
    <div>
      <form onSubmit={createAd} className="card" style={{ padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
        <input type="text" placeholder="Ad headline" value={form.headline} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
        <textarea placeholder="Ad copy" rows={2} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
        <button className="btn btn-primary" type="submit" style={{ justifySelf: "start" }}>Run ad</button>
      </form>
      {ads?.map((ad) => (
        <div key={ad.id} className="card" style={{ padding: 16, marginBottom: 10 }}>
          <div style={{ fontWeight: 700 }}>{ad.headline}</div>
          <div style={{ color: "var(--slate-400)", fontSize: 13 }}>{ad.body}</div>
        </div>
      ))}
      {ads?.length === 0 && <p style={{ color: "var(--slate-400)" }}>No ads running yet.</p>}
    </div>
  );
}

function RoadmapPanel({ label, desc }) {
  return (
    <div className="card" style={{ padding: 24, textAlign: "center" }}>
      <span className="eyebrow">Coming next</span>
      <h3 className="h-display" style={{ margin: "8px 0" }}>{label}</h3>
      <p style={{ color: "var(--slate-400)", maxWidth: 380, margin: "0 auto" }}>{desc}</p>
    </div>
  );
}

export default function Premium() {
  const { user, setUser } = useAuth();
  const [tab, setTab] = useState("marketplace");

  async function upgrade() {
    const { tier } = await api.post("/api/premium/upgrade");
    setUser((u) => ({ ...u, tier }));
  }

  const isPremium = user?.tier === "PREMIUM";

  return (
    <div className="container" style={{ maxWidth: 700, paddingTop: 28, paddingBottom: 60 }}>
      {!isPremium && <UpgradeCard onUpgrade={upgrade} />}

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            className="btn"
            style={{
              background: tab === s.key ? "var(--cyan-400)" : "var(--navy-800)",
              color: tab === s.key ? "var(--navy-950)" : "var(--slate-300)",
              border: "1px solid var(--line)",
            }}
            onClick={() => setTab(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {!isPremium && (
        <p style={{ color: "var(--slate-400)", fontSize: 13, marginBottom: 16 }}>
          Preview only below — upgrade to post listings and ads.
        </p>
      )}

      {tab === "marketplace" && (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <h3 className="h-display" style={{ margin: "0 0 8px", fontSize: 16 }}>Marketplace</h3>
          <p style={{ color: "var(--slate-400)", fontSize: 13, maxWidth: 380, margin: "0 auto 14px" }}>
            The marketplace now lives on its own page, with multi-photo and video
            listings, search, and condition/location details.
          </p>
          <Link to="/marketplace" className="btn btn-primary">Open Marketplace</Link>
        </div>
      )}
      {tab === "business" && (isPremium ? <AdsPanel category="BUSINESS" /> : <RoadmapPanel label="Business Place" desc="Run business storefronts and ads once you upgrade." />)}
      {tab === "political" && (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <h3 className="h-display" style={{ margin: "0 0 8px", fontSize: 16 }}>Political Place</h3>
          <p style={{ color: "var(--slate-400)", fontSize: 13, maxWidth: 400, margin: "0 auto 14px" }}>
            Campaign, candidate and issue pages, political ads with mandatory
            "paid for by" disclosure, and a permanent public ad archive.
          </p>
          <Link to="/political" className="btn btn-primary">Open Political Place</Link>
        </div>
      )}
      {tab === "media" && (
        <div className="card" style={{ padding: 24, textAlign: "center" }}>
          <h3 className="h-display" style={{ margin: "0 0 8px", fontSize: 16 }}>Media Coverage &amp; Live</h3>
          <p style={{ color: "var(--slate-400)", fontSize: 13, maxWidth: 420, margin: "0 auto 14px" }}>
            Newsroom pages with published stories, visible corrections, and live
            broadcasts attributed to the outlet. Live video runs on our own SFU —
            no third-party streaming provider needed.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/newsrooms" className="btn btn-primary">Open Media Coverage</Link>
            <Link to="/live" className="btn btn-ghost">Live broadcasts</Link>
          </div>
        </div>
      )}
    </div>
  );
}
