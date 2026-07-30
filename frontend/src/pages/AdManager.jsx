import { useEffect, useState } from "react";
import { api } from "../api";

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

  useEffect(() => {
    api.get("/api/profile/interests").then(({ interests }) => setInterests(interests)).catch(() => {});
    loadMyAds();
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
      await api.post("/api/premium/ads", {
        headline: form.headline,
        body: form.body,
        targetUrl: form.targetUrl || null,
        category: form.category,
      });
      setForm((f) => ({ ...f, headline: "", body: "", targetUrl: "" }));
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
        <button className="btn btn-primary" type="submit" disabled={creating} style={{ justifySelf: "start" }}>
          {creating ? "Creating…" : "Create ad"}
        </button>
        <p style={{ fontSize: 11, color: "var(--slate-400)", margin: 0 }}>
          Note: the targeting criteria above are applied when serving ads, but
          saving them onto a specific ad record requires the ad-creation
          endpoint to accept them — currently it stores the creative only. See
          the README's "Next build steps" for wiring targeting into ad creation.
        </p>
      </form>

      <h2 className="eyebrow" style={{ marginBottom: 10 }}>Your ads ({myAds.length})</h2>
      {myAds.length === 0 && <p style={{ color: "var(--slate-400)", fontSize: 13 }}>No ads yet.</p>}
      {myAds.map((ad) => (
        <div key={ad.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{ad.headline}</div>
              <div style={{ fontSize: 12, color: "var(--slate-400)" }}>{ad.category}</div>
            </div>
            <button className="btn btn-ghost" onClick={() => loadInsights(ad.id)} style={{ fontSize: 11, padding: "6px 10px" }}>
              View performance
            </button>
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
