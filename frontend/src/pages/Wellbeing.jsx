import { readScreenTime } from "../useScreenTime";

function formatMinutes(seconds) {
  const mins = Math.round(seconds / 60);
  return mins < 1 ? "<1 min" : `${mins} min`;
}

export default function Wellbeing() {
  const data = readScreenTime();
  const days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().slice(0, 10);
    return { key, label: d.toLocaleDateString(undefined, { weekday: "short" }), seconds: data[key] || 0 };
  });
  const maxSeconds = Math.max(...days.map((d) => d.seconds), 60);
  const todaySeconds = days[days.length - 1].seconds;

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Your time here</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 20 }}>
        Tracked entirely in your browser — never sent to a server, never used
        to target ads, never shared. This app also has no infinite scroll: the
        feed loads a fixed batch and stops, on purpose.
      </p>

      <div className="card" style={{ padding: 20, marginBottom: 20, textAlign: "center" }}>
        <div className="eyebrow">Today</div>
        <div className="h-display" style={{ fontSize: 32, margin: "6px 0" }}>{formatMinutes(todaySeconds)}</div>
      </div>

      <div className="card" style={{ padding: 20 }}>
        <div className="eyebrow" style={{ marginBottom: 14 }}>Last 7 days</div>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 140 }}>
          {days.map((d) => (
            <div key={d.key} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{
                width: "100%",
                height: `${Math.max(4, (d.seconds / maxSeconds) * 110)}px`,
                background: "linear-gradient(180deg, var(--cyan-400), var(--cyan-500))",
                borderRadius: 6,
              }} />
              <span style={{ fontSize: 11, color: "var(--slate-400)" }}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
