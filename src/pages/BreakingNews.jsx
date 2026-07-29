import { useEffect, useState } from "react";
import { api } from "../api";

const SOURCE_COLORS = {
  "ABC News": "#1877F2",
  "CNN": "#CC0000",
  "MSNBC": "#5C2D91",
  "BBC News": "#BB1919",
};

export default function BreakingNews() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const res = await api.get("/api/news/breaking");
      setData(res);
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Breaking news</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 20 }}>
        Pulled live from each network's own public feed — headlines and links
        only, tap through to read the full story on their site.
      </p>

      {error && <div className="card" style={{ padding: 16, color: "var(--danger)", fontSize: 13 }}>{error}</div>}
      {!data && !error && <p style={{ color: "var(--slate-400)" }}>Loading headlines…</p>}

      {data?.failedSources?.length > 0 && (
        <p style={{ fontSize: 12, color: "var(--slate-400)", marginBottom: 12 }}>
          Couldn't reach: {data.failedSources.join(", ")} (showing everyone else)
        </p>
      )}

      {data?.items?.map((item, i) => (
        <a key={i} href={item.link} target="_blank" rel="noopener noreferrer" className="card" style={{ display: "block", padding: 16, marginBottom: 10 }}>
          <span
            className="premium-pill"
            style={{ background: `${SOURCE_COLORS[item.source] || "#333"}22`, color: SOURCE_COLORS[item.source] || "var(--slate-300)", borderColor: `${SOURCE_COLORS[item.source] || "#333"}66` }}
          >
            {item.source}
          </span>
          <div style={{ fontWeight: 600, fontSize: 14, marginTop: 8 }}>{item.title}</div>
          {item.description && <div style={{ fontSize: 13, color: "var(--slate-400)", marginTop: 4 }}>{item.description}</div>}
        </a>
      ))}

      {data?.items?.length === 0 && <p style={{ color: "var(--slate-400)" }}>No headlines available right now.</p>}
    </div>
  );
}
