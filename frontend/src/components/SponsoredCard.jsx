import { useEffect, useRef, useState } from "react";
import { api } from "../api";

// Renders one ad in the feed and reports an impression once, when it's
// actually scrolled into view (not merely rendered off-screen) -- that's
// what makes impression counts meaningful to an advertiser rather than
// inflated. Uses IntersectionObserver rather than a scroll listener so it
// doesn't cost anything on every scroll frame.
export default function SponsoredCard({ ad }) {
  const ref = useRef(null);
  const reportedRef = useRef(false);
  const [showWhy, setShowWhy] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !reportedRef.current) {
            reportedRef.current = true;
            api.post("/api/ads/events", { adId: ad.id, type: "IMPRESSION" }).catch(() => {});
            observer.disconnect();
          }
        }
      },
      { threshold: 0.5 } // at least half the ad visible before it counts
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ad.id]);

  function handleClick() {
    api.post("/api/ads/events", { adId: ad.id, type: "CLICK" }).catch(() => {});
  }

  return (
    <article ref={ref} className="card" style={{ padding: 16, marginBottom: 14, borderColor: "rgba(41,211,245,0.25)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span className="premium-pill">Sponsored</span>
        <button onClick={() => setShowWhy((v) => !v)} style={{ fontSize: 11, color: "var(--slate-400)" }}>
          ⓘ Why this ad?
        </button>
      </div>

      {showWhy && (
        <div style={{ fontSize: 12, color: "var(--slate-300)", background: "var(--navy-950)", border: "1px solid var(--line)", borderRadius: 8, padding: 10, marginBottom: 10 }}>
          {ad.wasTargeted
            ? "This ad was matched to you using the demographics and interests on your profile, because you turned on interest-based targeting. You can turn that off any time in your profile's privacy settings."
            : "This ad isn't targeted — you're seeing it because interest-based targeting is turned off for your account, so everyone sees the same untargeted ads."}
        </div>
      )}

      <div style={{ fontWeight: 700, fontSize: 15 }}>{ad.headline}</div>
      <div style={{ fontSize: 14, color: "var(--slate-300)", marginTop: 4 }}>{ad.body}</div>
      {ad.imageUrl && (
        <img src={api.mediaUrl(ad.imageUrl)} alt="" style={{ width: "100%", borderRadius: 10, marginTop: 10, border: "1px solid var(--line)" }} />
      )}
      {ad.targetUrl && (
        <a href={ad.targetUrl} target="_blank" rel="noopener noreferrer sponsored" onClick={handleClick} className="btn btn-primary" style={{ marginTop: 12, fontSize: 13 }}>
          Learn more
        </a>
      )}
    </article>
  );
}
