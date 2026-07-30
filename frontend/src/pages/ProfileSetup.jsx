import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const RELATIONSHIP_OPTIONS = [
  ["SINGLE", "Single"],
  ["IN_RELATIONSHIP", "In a relationship"],
  ["ENGAGED", "Engaged"],
  ["MARRIED", "Married"],
  ["DOMESTIC_PARTNERSHIP", "Domestic partnership"],
  ["SEPARATED", "Separated"],
  ["DIVORCED", "Divorced"],
  ["WIDOWED", "Widowed"],
  ["PREFER_NOT_TO_SAY", "Prefer not to say"],
];

const GENDER_OPTIONS = ["Woman", "Man", "Non-binary", "Other", "Prefer not to say"];

export default function ProfileSetup() {
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    birthDate: "", gender: "", relationshipStatus: "", occupation: "",
    education: "", city: "", country: "", timezone: "", hasChildren: false, bio: "",
  });
  const [allInterests, setAllInterests] = useState([]);
  const [selectedInterests, setSelectedInterests] = useState([]);
  const [privacy, setPrivacy] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [{ profile, privacySettings }, { interests }] = await Promise.all([
          api.get("/api/profile/me"),
          api.get("/api/profile/interests"),
        ]);
        setAllInterests(interests);
        setPrivacy(privacySettings);
        setSelectedInterests((profile.interests || []).map((i) => i.id));
        setForm({
          birthDate: profile.birthDate ? profile.birthDate.slice(0, 10) : "",
          gender: profile.gender || "",
          relationshipStatus: profile.relationshipStatus || "",
          occupation: profile.occupation || "",
          education: profile.education || "",
          city: profile.city || "",
          country: profile.country || "",
          // Auto-detect the browser's timezone as a sensible default rather
          // than making people find themselves in a dropdown of 400+ zones.
          timezone: profile.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "",
          hasChildren: profile.hasChildren ?? false,
          bio: profile.bio || "",
        });
      } catch (err) {
        setError(err.message);
      }
    })();
  }, []);

  function set(field) {
    return (e) => {
      const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
      setForm((f) => ({ ...f, [field]: value }));
    };
  }

  function toggleInterest(id) {
    setSelectedInterests((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await api.patch("/api/profile/me", form);
      await api.put("/api/profile/me/interests", { interestIds: selectedInterests });
      await refresh();
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function updatePrivacy(field, value) {
    const { privacySettings } = await api.patch("/api/profile/me/privacy", { [field]: value });
    setPrivacy(privacySettings);
  }

  const grouped = allInterests.reduce((acc, i) => {
    const cat = i.category || "Other";
    (acc[cat] = acc[cat] || []).push(i);
    return acc;
  }, {});

  const localTime = form.timezone
    ? new Date().toLocaleTimeString([], { timeZone: form.timezone, hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="container" style={{ maxWidth: 680, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Complete your profile</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 20 }}>
        Everything here is optional. Fill in what you're comfortable sharing —
        you control what's used for ad targeting in the privacy section below.
      </p>

      {error && <div className="card" style={{ padding: 14, color: "var(--danger)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

      <form onSubmit={save}>
        <div className="card" style={{ padding: 18, marginBottom: 16, display: "grid", gap: 12 }}>
          <h2 className="eyebrow">About you</h2>

          <label style={{ fontSize: 12, color: "var(--slate-300)" }}>
            Birth date
            <input type="date" value={form.birthDate} onChange={set("birthDate")} style={{ marginTop: 4 }} />
          </label>

          <label style={{ fontSize: 12, color: "var(--slate-300)" }}>
            Gender
            <select value={form.gender} onChange={set("gender")} style={{ width: "100%", marginTop: 4, padding: "10px 13px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--navy-950)", color: "var(--white)", fontSize: 13 }}>
              <option value="">Prefer not to say</option>
              {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>

          <label style={{ fontSize: 12, color: "var(--slate-300)" }}>
            Relationship status
            <select value={form.relationshipStatus} onChange={set("relationshipStatus")} style={{ width: "100%", marginTop: 4, padding: "10px 13px", borderRadius: 10, border: "1px solid var(--line)", background: "var(--navy-950)", color: "var(--white)", fontSize: 13 }}>
              <option value="">Not specified</option>
              {RELATIONSHIP_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate-300)" }}>
            <input type="checkbox" checked={form.hasChildren} onChange={set("hasChildren")} />
            I have children
          </label>

          <label style={{ fontSize: 12, color: "var(--slate-300)" }}>
            Occupation
            <input type="text" value={form.occupation} onChange={set("occupation")} placeholder="e.g. Software engineer" style={{ marginTop: 4 }} />
          </label>

          <label style={{ fontSize: 12, color: "var(--slate-300)" }}>
            Education
            <input type="text" value={form.education} onChange={set("education")} placeholder="e.g. BSc Computer Science" style={{ marginTop: 4 }} />
          </label>

          <label style={{ fontSize: 12, color: "var(--slate-300)" }}>
            Bio
            <textarea value={form.bio} onChange={set("bio")} rows={2} placeholder="A short intro" style={{ marginTop: 4 }} />
          </label>
        </div>

        <div className="card" style={{ padding: 18, marginBottom: 16, display: "grid", gap: 12 }}>
          <h2 className="eyebrow">Location & time</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, color: "var(--slate-300)", flex: 1, minWidth: 140 }}>
              City
              <input type="text" value={form.city} onChange={set("city")} style={{ marginTop: 4 }} />
            </label>
            <label style={{ fontSize: 12, color: "var(--slate-300)", flex: 1, minWidth: 140 }}>
              Country
              <input type="text" value={form.country} onChange={set("country")} style={{ marginTop: 4 }} />
            </label>
          </div>
          <label style={{ fontSize: 12, color: "var(--slate-300)" }}>
            Timezone {localTime && <span style={{ color: "var(--cyan-300)" }}>— your local time is {localTime}</span>}
            <input type="text" value={form.timezone} onChange={set("timezone")} placeholder="e.g. America/New_York" style={{ marginTop: 4 }} />
          </label>
        </div>

        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <h2 className="eyebrow" style={{ marginBottom: 10 }}>Interests</h2>
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: "var(--slate-400)", marginBottom: 6 }}>{category}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {items.map((i) => (
                  <button
                    type="button"
                    key={i.id}
                    onClick={() => toggleInterest(i.id)}
                    className="btn"
                    style={{
                      fontSize: 12, padding: "6px 10px",
                      background: selectedInterests.includes(i.id) ? "var(--cyan-400)" : "var(--navy-800)",
                      color: selectedInterests.includes(i.id) ? "var(--navy-950)" : "var(--slate-300)",
                      border: "1px solid var(--line)",
                    }}
                  >
                    {i.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {allInterests.length === 0 && <p style={{ color: "var(--slate-400)", fontSize: 13 }}>Interest list is still loading or hasn't been seeded yet.</p>}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"}</button>
          {saved && <span style={{ color: "var(--cyan-300)", fontSize: 13 }}>Saved</span>}
          <button type="button" className="btn btn-ghost" onClick={() => navigate("/places")}>Manage places →</button>
        </div>
      </form>

      {privacy && (
        <div className="card" style={{ padding: 18 }}>
          <h2 className="eyebrow" style={{ marginBottom: 6 }}>Privacy & ad settings</h2>
          <p style={{ fontSize: 12, color: "var(--slate-400)", marginBottom: 14 }}>
            NexgenSocial is free and funded by advertising. These are all off by
            default — you'll see ads either way, but turning these on makes them
            more relevant. We never sell your individual profile to anyone.
          </p>
          {[
            ["allowInterestTargeting", "Use my demographics and interests to choose which ads I see"],
            ["allowBehavioralTracking", "Record which ads I view and click, to improve relevance and measure results"],
            ["allowAggregateInsights", "Include me in anonymous, aggregate audience counts shown to advertisers"],
            ["showVisitedPlaces", "Show my saved places on my public profile"],
          ].map(([key, label]) => (
            <label key={key} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, color: "var(--slate-300)", marginBottom: 10 }}>
              <input type="checkbox" checked={!!privacy[key]} onChange={(e) => updatePrivacy(key, e.target.checked)} style={{ marginTop: 3 }} />
              {label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
