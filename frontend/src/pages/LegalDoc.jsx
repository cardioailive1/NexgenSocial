import { useParams, Link } from "react-router-dom";
import { PRIVACY_POLICY, TERMS_OF_USE, POLICY_VERSION } from "../legal/documents";

// Minimal markdown renderer -- these documents only use headings, bold,
// lists, and paragraphs, so pulling in a full markdown library for this
// would be more dependency than the job needs.
function renderMarkdown(md) {
  const lines = md.split("\n");
  const out = [];
  let listBuffer = [];

  function flushList(key) {
    if (listBuffer.length === 0) return;
    out.push(
      <ul key={`ul-${key}`} style={{ margin: "8px 0 14px", paddingLeft: 20, color: "var(--slate-300)", fontSize: 14, lineHeight: 1.7 }}>
        {listBuffer.map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inline(item) }} />)}
      </ul>
    );
    listBuffer = [];
  }

  function inline(text) {
    return text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (line.startsWith("- ")) { listBuffer.push(line.slice(2)); return; }
    flushList(i);

    if (line.startsWith("## ")) {
      out.push(<h2 key={i} className="h-display" style={{ fontSize: 17, marginTop: 26, marginBottom: 8 }}>{line.slice(3)}</h2>);
    } else if (line.startsWith("# ")) {
      out.push(<h1 key={i} className="h-display" style={{ fontSize: 24, marginBottom: 8 }}>{line.slice(2)}</h1>);
    } else if (line.trim() === "") {
      // paragraph break, nothing to render
    } else {
      out.push(<p key={i} style={{ fontSize: 14, lineHeight: 1.7, color: "var(--slate-300)", margin: "0 0 12px" }}
        dangerouslySetInnerHTML={{ __html: inline(line) }} />);
    }
  });
  flushList("end");
  return out;
}

export default function LegalDoc() {
  const { doc } = useParams();
  const isPrivacy = doc === "privacy";
  const content = isPrivacy ? PRIVACY_POLICY : TERMS_OF_USE;

  return (
    <div className="container" style={{ maxWidth: 720, paddingTop: 28, paddingBottom: 60 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <Link to="/legal/privacy" className="btn"
          style={{ background: isPrivacy ? "var(--cyan-400)" : "var(--navy-800)", color: isPrivacy ? "var(--navy-950)" : "var(--slate-300)", border: "1px solid var(--line)" }}>
          Privacy Policy
        </Link>
        <Link to="/legal/terms" className="btn"
          style={{ background: !isPrivacy ? "var(--cyan-400)" : "var(--navy-800)", color: !isPrivacy ? "var(--navy-950)" : "var(--slate-300)", border: "1px solid var(--line)" }}>
          Terms of Use
        </Link>
      </div>

      <div className="card" style={{ padding: 24 }}>
        {renderMarkdown(content)}
      </div>

      <p style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 14, textAlign: "center" }}>
        Version {POLICY_VERSION}
      </p>
    </div>
  );
}
