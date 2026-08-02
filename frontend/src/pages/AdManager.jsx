import { useEffect, useState } from "react";
import { api } from "../api";
import { MediaPicker, MediaGallery } from "../components/MediaAttach";

const RELATIONSHIP_OPTIONS = ["SINGLE", "IN_RELATIONSHIP", "ENGAGED", "MARRIED", "DIVORCED", "WIDOWED"];
const GENDER_OPTIONS = ["Woman", "Man", "Non-binary", "Other"];

export default function AdManager() {
  const [interests, setInterests] = useState([]);
  const [form, setForm] = useState({
    headline: "", body: "", targetUrl: "", category: "BUSINESS",
    targetMinAge: "", targetMaxAge: "", targetGenders: [], targetCities: "",
    targetCountries: "", targetRelationshipStatuses: [], interestIds: [],
  });
  const [estimate, setEstimate] = useState(null);
  const [myAds, setMyAds] = useState([]);
  const [insights, setInsights] = useState({});
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [adMedia, setAdMedia] = useState([]);
  const [extendAmount, setExtendAmount] = useState({});
  const [pricing, setPricing] = useState(null);
  const [createdAd, setCreatedAd] = useState(null);
  const [paymentRef, setPaymentRef] = useState("");

  useEffect(() => {
    api.get("/api/profile/interests").then(({ interests }) => setInterests(interests)).catch(() => {});
    loadMyAds();
  }, []);

  useEffect(() => {
    api.get("/api/ads/pricing").then(setPricing).catch(() => {});
  }, []);

  async function loadMyAds() {
    try {
      const { ads } = await api.get("/api/premium/ads");
      setMyAds(ads);
    } catch {
      setMyAds([]);
    }
  }

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  function toggleArrayField(field, value) {
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter((v) => v !== value) : [...f[field], value],
    }));
  }

  async function getEstimate() {
    setError("");
    try {
      const payload = {
        minAge: form.targetMinAge ? Number(form.targetMinAge) : null,
        maxAge: form.targetMaxAge ? Number(form.targetMaxAge) : null,
        genders: form.targetGenders,
        cities: form.targetCities ? form.targetCities.split(",").map((s) => s.trim()).filter(Boolean) : [],
        countries: form.targetCountries ? form.targetCountries.split(",").map((s) => s.trim()).filter(Boolean) : [],
        relationshipStatuses: form.targetRelationshipStatuses,
        interestIds: form.interestIds,
      };
      setEstimate(await api.post("/api/ads/audience-estimate", payload));
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadInsights(adId) {
    try {
      const data = await api.get(`/api/ads/${adId}/insights`);
      setInsights((s) => ({ ...s, [adId]: data }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function createAd(e) {
    e.preventDefault();
    if (!form.headline || !form.body) {
      setError("Headline and body are required.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("headline", form.headline);
      fd.append("body", form.body);
      fd.append("category", form.category);
      if (form.targetUrl) fd.append("targetUrl", form.targetUrl);
      adMedia.forEach((f) => fd.append("media", f));

      const res = await api.upload("/api/premium/ads", fd);
      setCreatedAd(res.ad);
      setForm((f) => ({ ...f, headline: "", body: "", targetUrl: "" }));
      setAdMedia([]);
      await loadMyAds();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  const selectStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)",
    background: "var(--navy-950)", color: "var(--white)", fontSize: 13,
  };

  return (
    <div className="container" style={{ maxWidth: 680, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Ad manager</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 20 }}>
        Create campaigns, estimate reach, and see performance. All audience
        figures are aggregate counts — individual user profiles are never
        exposed here, by design.
      </p>

      {error && <div className="card" style={{ padding: 14, color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <div className="card" style={{ padding: 18, marginBottom: 16, display: "grid", gap: 12 }}>
        <h2 className="eyebrow">Audience targeting</h2>
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ fontSize: 12, color: "var(--slate-300)", flex: 1 }}>
            Min age
            <input type="number" value={form.targetMinAge} onChange={set("targetMinAge")} style={{ marginTop: 4 }} />
          </label>
          <label style={{ fontSize: 12, color: "var(--slate-300)", flex: 1 }}>
            Max age
            <input type="number" value={form.targetMaxAge} onChange={set("targetMaxAge")} style={{ marginTop: 4 }} />
          </label>
        </div>

        <div>
          <div style={{ fontSize: 12, color: "var(--slate-300)", marginBottom: 6 }}>Genders (leave empty for any)</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {GENDER_OPTIONS.map((g) => (
              <button type="button" key={g} onClick={() => toggleArrayField("targetGenders", g)} className="btn"
                style={{ fontSize: 12, padding: "6px 10px", background: form.targetGenders.includes(g) ? "var(--cyan-400)" : "var(--navy-800)", color: form.targetGenders.includes(g) ? "var(--navy-950)" : "var(--slate-300)", border: "1px solid var(--line)" }}>
                {g}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, color: "var(--slate-300)", marginBottom: 6 }}>Relationship status (leave empty for any)</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {RELATIONSHIP_OPTIONS.map((r) => (
              <button type="button" key={r} onClick={() => toggleArrayField("targetRelationshipStatuses", r)} className="btn"
                style={{ fontSize: 12, padding: "6px 10px", background: form.targetRelationshipStatuses.includes(r) ? "var(--cyan-400)" : "var(--navy-800)", color: form.targetRelationshipStatuses.includes(r) ? "var(--navy-950)" : "var(--slate-300)", border: "1px solid var(--line)" }}>
                {r.replace(/_/g, " ").toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        <label style={{ fontSize: 12, color: "var(--slate-300)" }}>
          Cities (comma-separated)
          <input type="text" value={form.targetCities} onChange={set("targetCities")} placeholder="Columbus, Chicago" style={{ marginTop: 4 }} />
        </label>
        <label style={{ fontSize: 12, color: "var(--slate-300)" }}>
          Countries (comma-separated)
          <input type="text" value={form.targetCountries} onChange={set("targetCountries")} placeholder="US, CA" style={{ marginTop: 4 }} />
        </label>

        <div>
          <div style={{ fontSize: 12, color: "var(--slate-300)", marginBottom: 6 }}>Interests</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 160, overflowY: "auto" }}>
            {interests.map((i) => (
              <button type="button" key={i.id} onClick={() => toggleArrayField("interestIds", i.id)} className="btn"
                style={{ fontSize: 12, padding: "6px 10px", background: form.interestIds.includes(i.id) ? "var(--cyan-400)" : "var(--navy-800)", color: form.interestIds.includes(i.id) ? "var(--navy-950)" : "var(--slate-300)", border: "1px solid var(--line)" }}>
                {i.name}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="btn btn-ghost" onClick={getEstimate} style={{ justifySelf: "start" }}>
          Estimate audience reach
        </button>

        {estimate && (
          <div style={{ fontSize: 13, background: "var(--navy-950)", border: "1px solid var(--line)", borderRadius: 8, padding: 12 }}>
            {estimate.suppressed ? (
              <span style={{ color: "var(--danger)" }}>{estimate.note}</span>
            ) : (
              <>
                <div className="h-display" style={{ fontSize: 20, color: "var(--cyan-300)" }}>~{estimate.estimatedReach} people</div>
                <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 4 }}>{estimate.note}</div>
              </>
            )}
          </div>
        )}
      </div>

      <form onSubmit={createAd} className="card" style={{ padding: 18, marginBottom: 16, display: "grid", gap: 12 }}>
        <h2 className="eyebrow">Ad creative</h2>
        <input type="text" placeholder="Headline" value={form.headline} onChange={set("headline")} />
        <textarea placeholder="Ad copy" rows={2} value={form.body} onChange={set("body")} />
        <input type="text" placeholder="Destination URL (optional)" value={form.targetUrl} onChange={set("targetUrl")} />
        <select value={form.category} onChange={set("category")} style={selectStyle}>
          <option value="BUSINESS">Business</option>
          <option value="POLITICAL">Political</option>
          <option value="GENERAL">General</option>
        </select>

        <MediaPicker files={adMedia} onChange={setAdMedia} max={5} label="🎬 Ad photos & video" />

        <div style={{ padding: 12, background: "var(--navy-950)", border: "1px solid var(--line)", borderRadius: 10 }}>
          <div className="eyebrow" style={{ fontSize: 10, marginBottom: 8 }}>What $50 gets you</div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 12.5, color: "var(--slate-300)" }}>
            <div>
              <div className="h-display" style={{ fontSize: 20, color: "var(--cyan-300)" }}>
                ${((pricing?.starter?.priceCents ?? 5000) / 100).toFixed(2)}
              </div>
              <div style={{ fontSize: 11, color: "var(--slate-400)" }}>one-off</div>
            </div>
            <div>
              <div className="h-display" style={{ fontSize: 20 }}>{pricing?.starter?.durationDays ?? 1} day</div>
              <div style={{ fontSize: 11, color: "var(--slate-400)" }}>runtime</div>
            </div>
            <div>
              <div className="h-display" style={{ fontSize: 20 }}>
                {(pricing?.starter?.reachCap ?? 1000).toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: "var(--slate-400)" }}>people reached</div>
            </div>
          </div>
          <p style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
            Every campaign starts here. Once it's running you can extend it for
            any amount — more days and more people, in proportion to what you add.
          </p>
        </div>
        <button className="btn btn-primary" type="submit" disabled={creating} style={{ justifySelf: "start" }}>
          {creating ? "Creating…" : `Create ad — $${((pricing?.starter?.priceCents ?? 5000) / 100).toFixed(2)}`}
        </button>
        <p style={{ fontSize: 11, color: "var(--slate-400)", margin: 0 }}>
          Note: the targeting criteria above are applied when serving ads, but
          saving them onto a specific ad record requires the ad-creation
          endpoint to accept them — currently it stores the creative only. See
          the README's "Next build steps" for wiring targeting into ad creation.
        </p>
      </form>

      {createdAd && createdAd.paymentStatus !== "PAID" && (
        <div className="card" style={{ padding: 16, marginBottom: 16, borderColor: "var(--cyan-400)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>One step left — pay to start your ad</div>
          <p style={{ fontSize: 12.5, color: "var(--slate-300)", lineHeight: 1.6, marginTop: 0 }}>
            "{createdAd.headline}" is saved but <strong>will not run until payment is confirmed</strong>.
            Pay <strong style={{ color: "var(--cyan-300)" }}>${(createdAd.budgetCents / 100).toFixed(2)}</strong> for
            a {createdAd.durationDays}-day campaign, then paste the reference from your receipt below.
          </p>

          <button className="btn btn-primary" onClick={async () => {
            try {
              const res = await api.post(`/api/premium/ads/${createdAd.id}/checkout`, {});
              if (res.checkoutUrl) window.location.href = res.checkoutUrl;
            } catch (err) {
              // Falls back to the plain payment link if Checkout isn't
              // available, so the flow still works either way.
              if (pricing?.paymentUrl) window.open(pricing.paymentUrl, "_blank", "noopener");
              else setError(err.message);
            }
          }}>
            Pay ${((createdAd.budgetCents ?? 5000) / 100).toFixed(2)} with Stripe ↗
          </button>

          <p style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 10, lineHeight: 1.5 }}>
            Your ad starts automatically once payment completes.
          </p>
        </div>
      )}

      <h2 className="eyebrow" style={{ marginBottom: 10 }}>Your ads ({myAds.length})</h2>
      {myAds.length === 0 && <p style={{ color: "var(--slate-400)", fontSize: 13 }}>No ads yet.</p>}
      {myAds.map((ad) => (
        <div key={ad.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>{ad.headline}</span>
                {ad.paymentStatus === "PAID"
                  ? <span className="premium-pill">Running</span>
                  : <span className="premium-pill" style={{ background: "rgba(255,107,107,0.12)", color: "var(--danger)", borderColor: "rgba(255,107,107,0.3)" }}>Awaiting payment</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--slate-400)" }}>
                {ad.category}
                {ad.budgetCents ? ` · $${(ad.budgetCents / 100).toFixed(2)}` : ""}
                {ad.durationDays ? ` · ${ad.durationDays} days` : ""}
              </div>
              {ad.media?.length > 0 && <MediaGallery media={ad.media} compact />}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <button className="btn btn-ghost" onClick={() => loadInsights(ad.id)} style={{ fontSize: 11, padding: "6px 10px" }}>
                View performance
              </button>
              {ad.paymentStatus === "PAID" && (
                <>
                  <input type="number" min={5} placeholder="$"
                    value={extendAmount[ad.id] || ""}
                    onChange={(e) => setExtendAmount((s) => ({ ...s, [ad.id]: e.target.value }))}
                    style={{ width: 80, fontSize: 11, padding: "5px 8px" }} />
                  <button className="btn btn-primary" style={{ fontSize: 11, padding: "6px 10px" }}
                    onClick={async () => {
                      const amt = Number(extendAmount[ad.id]);
                      if (!amt || amt < 5) { setError("The minimum top-up is $5."); return; }
                      try {
                        const res = await api.post(`/api/premium/ads/${ad.id}/extend/checkout`, {
                          topUpCents: Math.round(amt * 100),
                        });
                        if (res.checkoutUrl) window.location.href = res.checkoutUrl;
                      } catch (err) { setError(err.message); }
                    }}>
                    Extend
                  </button>
                </>
              )}
            </div>
          </div>

          {insights[ad.id] && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)", fontSize: 13 }}>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <div><div className="eyebrow" style={{ fontSize: 10 }}>Impressions</div><strong>{insights[ad.id].performance.impressions}</strong></div>
                <div><div className="eyebrow" style={{ fontSize: 10 }}>Clicks</div><strong>{insights[ad.id].performance.clicks}</strong></div>
                <div><div className="eyebrow" style={{ fontSize: 10 }}>CTR</div><strong>{insights[ad.id].performance.clickThroughRate}%</strong></div>
                <div><div className="eyebrow" style={{ fontSize: 10 }}>Conversions</div><strong>{insights[ad.id].performance.conversions}</strong></div>
                <div><div className="eyebrow" style={{ fontSize: 10 }}>Conv. rate</div><strong>{insights[ad.id].performance.conversionRate}%</strong></div>
                <div>
                  <div className="eyebrow" style={{ fontSize: 10 }}>Reach</div>
                  <strong>
                    {insights[ad.id].performance.distinctReachSuppressed
                      ? "—"
                      : insights[ad.id].performance.distinctReach}
                  </strong>
                </div>
              </div>
              {insights[ad.id].performance.distinctReachSuppressed && (
                <p style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 8 }}>
                  Distinct reach is hidden until at least 25 people have engaged —
                  below that, the number could identify individuals.
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
