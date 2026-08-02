// Shown alongside the signup form. Every item here describes something the
// app actually does today -- nothing aspirational, nothing on a roadmap.
// If a feature is removed, remove it here too: a signup page that oversells
// is the fastest way to lose the trust you gain at signup.
const HIGHLIGHTS = [
  {
    icon: "🎬",
    title: "Reels that reach beyond your followers",
    body: "Record, trim, colour-grade and caption short video in the browser. Reels rank on whether people watch to the end, not on follower count — so a good first post can travel.",
  },
  {
    icon: "🎛",
    title: "Your feed, your rules",
    body: "Set how much your feed weights recency, engagement and diversity. Every post tells you why you're seeing it.",
  },
  {
    icon: "🔒",
    title: "Ad settings off by default",
    body: "We're free and ad-funded, but interest targeting and behavioural tracking are opt-in, not opt-out. We never sell your profile to advertisers.",
  },
  {
    icon: "💬",
    title: "Messages, voice and video calls",
    body: "Talk to anyone on NexgenSocial from anywhere with an internet connection — no phone plan needed.",
  },
  {
    icon: "🎥",
    title: "NexgenMeet",
    body: "Host video meetings with waiting rooms, screen sharing and chat. Invite friends or a whole group. Recordings stay private until you choose to publish or download them.",
  },
  {
    icon: "🛍",
    title: "Marketplace and jobs",
    body: "Buy and sell with real photo and video listings, or find work — with salary ranges shown up front, not hidden.",
  },
  {
    icon: "📰",
    title: "Newsrooms, sports and politics",
    body: "Live scores, breaking headlines, newsroom pages with visible corrections, and political ads that carry mandatory funding disclosure in a permanent public archive.",
  },
  {
    icon: "📊",
    title: "Take your data with you",
    body: "Export everything you've ever posted as a single file, any time, in one click. No support ticket, no waiting.",
  },
];

export default function PlatformHighlights() {
  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <h2 className="h-display" style={{ fontSize: 19, margin: "0 0 6px" }}>
          A social platform that shows its working
        </h2>
        <p style={{ fontSize: 13, color: "var(--slate-400)", margin: 0, lineHeight: 1.6 }}>
          Most of what's below exists elsewhere in some form. What's different
          here is that the controls are yours and the mechanics are visible.
        </p>
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {HIGHLIGHTS.map((h) => (
          <div key={h.title} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
            <div style={{
              fontSize: 17, lineHeight: 1, flexShrink: 0, width: 34, height: 34,
              borderRadius: 9, background: "var(--navy-800)", border: "1px solid var(--line)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {h.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5, marginBottom: 2 }}>{h.title}</div>
              <div style={{ fontSize: 12.5, color: "var(--slate-400)", lineHeight: 1.55 }}>{h.body}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: 12, marginTop: 16, background: "var(--navy-950)" }}>
        <p style={{ fontSize: 11.5, color: "var(--slate-400)", margin: 0, lineHeight: 1.6 }}>
          Free to use, funded by advertising. You'll see ads either way — how
          personalised they are is entirely your choice, and you can change it
          whenever you like.
        </p>
      </div>
    </div>
  );
}
