import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { MediaPicker, MediaGallery } from "../components/MediaAttach";

const PAGE_TYPES = [
  ["CANDIDATE", "Candidate"],
  ["PARTY", "Party"],
  ["ISSUE", "Issue"],
  ["CAMPAIGN", "Campaign"],
  ["ORGANIZATION", "Organization"],
];

function PageCard({ page, onToggleFollow, busy }) {
  return (
    <div className="card" style={{ padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <img className="avatar" style={{ width: 44, height: 44 }}
          src={api.mediaUrl(page.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${page.name}`} alt="" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>{page.name}</span>
            <span className="premium-pill" style={{ background: "rgba(148,197,226,0.12)", color: "var(--slate-300)", borderColor: "var(--line)" }}>
              {page.type}
            </span>
            {page.verified
              ? <span className="premium-pill">✓ Verified</span>
              : <span className="premium-pill" style={{ background: "rgba(255,107,107,0.12)", color: "var(--danger)", borderColor: "rgba(255,107,107,0.3)" }}>Unverified</span>}
          </div>
          {page.description && <div style={{ fontSize: 12, color: "var(--slate-300)", marginTop: 4 }}>{page.description}</div>}
          {/* Always shown, never truncated away -- who is behind a political
              page is the single most important thing a reader needs. */}
          <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 6 }}>
            Run by <strong style={{ color: "var(--slate-300)" }}>{page.organization}</strong>
            {page.region ? ` · ${page.region}` : ""}
          </div>
          <div className="eyebrow" style={{ fontSize: 10, marginTop: 6 }}>
            {page.followerCount} followers · {page.postCount} posts · {page.adCount} ads
          </div>
        </div>
        <button
          className={page.followedByViewer ? "btn btn-ghost" : "btn btn-primary"}
          disabled={busy}
          onClick={() => onToggleFollow(page)}
          style={{ fontSize: 11, padding: "6px 10px" }}
        >
          {page.followedByViewer ? "Following" : "Follow"}
        </button>
      </div>
    </div>
  );
}

export default function Political() {
  const { user } = useAuth();
  const [tab, setTab] = useState("pages");
  const [pages, setPages] = useState(null);
  const [typeFilter, setTypeFilter] = useState("");
  const [archive, setArchive] = useState(null);
  const [archiveQuery, setArchiveQuery] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const [showPageForm, setShowPageForm] = useState(false);
  const [pageForm, setPageForm] = useState({ type: "CAMPAIGN", name: "", organization: "", description: "", websiteUrl: "", region: "" });
  const [creatingPage, setCreatingPage] = useState(false);
  const [pageAvatar, setPageAvatar] = useState([]);
  const [adMedia, setAdMedia] = useState([]);
  const [postForm, setPostForm] = useState({ pageId: "", body: "" });
  const [postMedia, setPostMedia] = useState([]);
  const [posting, setPosting] = useState(false);

  const [showAdForm, setShowAdForm] = useState(false);
  const [adForm, setAdForm] = useState({ pageId: "", headline: "", body: "", targetUrl: "", paidForBy: "", spend: "", region: "" });
  const [creatingAd, setCreatingAd] = useState(false);
  const [myPages, setMyPages] = useState([]);

  async function loadPages(type = "") {
    setError("");
    try {
      const { pages } = await api.get(`/api/political/pages${type ? `?type=${type}` : ""}`);
      setPages(pages);
      setMyPages(pages.filter((p) => p.owner?.username === user?.username));
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadArchive(q = "") {
    try {
      const { ads } = await api.get(`/api/political/archive${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setArchive(ads);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { loadPages(); }, [user]);
  useEffect(() => { if (tab === "archive") loadArchive(archiveQuery); }, [tab]);

  async function toggleFollow(page) {
    setBusyId(page.id);
    try {
      if (page.followedByViewer) await api.delete(`/api/political/pages/${page.id}/follow`);
      else await api.post(`/api/political/pages/${page.id}/follow`);
      await loadPages(typeFilter);
    } finally {
      setBusyId(null);
    }
  }

  async function createPage(e) {
    e.preventDefault();
    if (!pageForm.name || !pageForm.organization) {
      setError("A page name and the responsible organization are both required.");
      return;
    }
    setCreatingPage(true);
    setError("");
    try {
      // Was api.post with JSON, so the avatar the backend expected never
      // actually arrived. FormData is required for any file to be sent.
      const fd = new FormData();
      Object.entries(pageForm).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (pageAvatar[0]) fd.append("avatar", pageAvatar[0]);
      await api.upload("/api/political/pages", fd);
      setPageForm({ type: "CAMPAIGN", name: "", organization: "", description: "", websiteUrl: "", region: "" });
      setPageAvatar([]);
      setShowPageForm(false);
      await loadPages(typeFilter);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingPage(false);
    }
  }

  async function createAd(e) {
    e.preventDefault();
    if (!adForm.pageId || !adForm.headline || !adForm.body || !adForm.paidForBy) {
      setError('Page, headline, body, and the "Paid for by" disclosure are all required.');
      return;
    }
    setCreatingAd(true);
    setError("");
    try {
      const fd = new FormData();
      Object.entries(adForm).forEach(([k, v]) => { if (v && k !== "spend") fd.append(k, v); });
      fd.append("spendCents", String(adForm.spend ? Math.round(parseFloat(adForm.spend) * 100) : 0));
      if (adMedia[0]) fd.append("media", adMedia[0]);
      await api.upload("/api/political/ads", fd);
      setAdForm({ pageId: "", headline: "", body: "", targetUrl: "", paidForBy: "", spend: "", region: "" });
      setAdMedia([]);
      setShowAdForm(false);
      await loadPages(typeFilter);
      setTab("archive");
      await loadArchive();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreatingAd(false);
    }
  }

  async function publishPost(e) {
    e.preventDefault();
    if (!postForm.pageId || !postForm.body.trim()) {
      setError("Choose a page and write something to post.");
      return;
    }
    setPosting(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("body", postForm.body);
      postMedia.forEach((f) => fd.append("media", f));
      await api.upload(`/api/political/pages/${postForm.pageId}/posts`, fd);
      setPostForm({ pageId: "", body: "" });
      setPostMedia([]);
      await loadPages(typeFilter);
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  const selectStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)",
    background: "var(--navy-950)", color: "var(--white)", fontSize: 13,
  };

  return (
    <div className="container" style={{ maxWidth: 700, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Political Place</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 16 }}>
        Campaign pages, issue groups, and political advertising — with mandatory
        disclosure and a permanent public archive of every ad ever run.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["pages", "Pages"], ["create", "Create"], ["archive", "Ad archive"]].map(([key, label]) => (
          <button key={key} className="btn" onClick={() => setTab(key)}
            style={{
              background: tab === key ? "var(--cyan-400)" : "var(--navy-800)",
              color: tab === key ? "var(--navy-950)" : "var(--slate-300)",
              border: "1px solid var(--line)",
            }}>
            {label}
          </button>
        ))}
      </div>

      {error && <div className="card" style={{ padding: 12, color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {tab === "pages" && (
        <>
          <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => { setTypeFilter(""); loadPages(""); }}
              style={{ fontSize: 11, padding: "5px 10px", background: !typeFilter ? "var(--cyan-400)" : "var(--navy-800)", color: !typeFilter ? "var(--navy-950)" : "var(--slate-300)", border: "1px solid var(--line)" }}>
              All
            </button>
            {PAGE_TYPES.map(([v, l]) => (
              <button key={v} className="btn" onClick={() => { setTypeFilter(v); loadPages(v); }}
                style={{ fontSize: 11, padding: "5px 10px", background: typeFilter === v ? "var(--cyan-400)" : "var(--navy-800)", color: typeFilter === v ? "var(--navy-950)" : "var(--slate-300)", border: "1px solid var(--line)" }}>
                {l}
              </button>
            ))}
          </div>

          {pages === null && <p style={{ color: "var(--slate-400)" }}>Loading…</p>}
          {pages?.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--slate-400)", fontSize: 13 }}>
              No political pages yet.
            </div>
          )}
          {pages?.map((p) => (
            <PageCard key={p.id} page={p} onToggleFollow={toggleFollow} busy={busyId === p.id} />
          ))}
        </>
      )}

      {tab === "create" && (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 16, borderColor: "rgba(41,211,245,0.25)" }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Before you start</div>
            <p style={{ fontSize: 12, color: "var(--slate-300)", margin: 0, lineHeight: 1.5 }}>
              Political pages must name the organization responsible for them, and
              political ads must carry a "Paid for by" disclosure. Both are
              required by election law in most jurisdictions (in the US, the FEC;
              in the EU, the Political Advertising Regulation), and both are
              enforced here rather than left optional. Every ad also enters a
              permanent public archive.
            </p>
          </div>

          <button className="btn btn-primary" onClick={() => setShowPageForm((v) => !v)} style={{ marginBottom: 12 }}>
            {showPageForm ? "Cancel" : "+ Create a political page"}
          </button>

          {showPageForm && (
            <form onSubmit={createPage} className="card" style={{ padding: 16, marginBottom: 20, display: "grid", gap: 10 }}>
              <select value={pageForm.type} onChange={(e) => setPageForm({ ...pageForm, type: e.target.value })} style={selectStyle}>
                {PAGE_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="text" placeholder="Page name" value={pageForm.name} onChange={(e) => setPageForm({ ...pageForm, name: e.target.value })} />
              <input type="text" placeholder="Responsible organization (required, shown publicly)" value={pageForm.organization} onChange={(e) => setPageForm({ ...pageForm, organization: e.target.value })} />
              <textarea rows={2} placeholder="What is this page about?" value={pageForm.description} onChange={(e) => setPageForm({ ...pageForm, description: e.target.value })} />
              <input type="text" placeholder="Website (optional)" value={pageForm.websiteUrl} onChange={(e) => setPageForm({ ...pageForm, websiteUrl: e.target.value })} />
              <input type="text" placeholder="Region / jurisdiction (e.g. Ohio, US)" value={pageForm.region} onChange={(e) => setPageForm({ ...pageForm, region: e.target.value })} />
              <MediaPicker files={pageAvatar} onChange={(f) => setPageAvatar(f.slice(0, 1))} max={1} label="🖼 Page logo / photo" />
              <button className="btn btn-primary" type="submit" disabled={creatingPage} style={{ justifySelf: "start" }}>
                {creatingPage ? "Creating…" : "Create page"}
              </button>
            </form>
          )}

          {myPages.length > 0 && (
            <>
              <form onSubmit={publishPost} className="card" style={{ padding: 16, marginBottom: 16, display: "grid", gap: 10 }}>
                <h2 className="eyebrow">Post to one of your pages</h2>
                <select value={postForm.pageId} onChange={(e) => setPostForm({ ...postForm, pageId: e.target.value })} style={selectStyle}>
                  <option value="">Choose a page…</option>
                  {myPages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <textarea rows={3} placeholder="What do you want to say?" value={postForm.body} onChange={(e) => setPostForm({ ...postForm, body: e.target.value })} />
                <MediaPicker files={postMedia} onChange={setPostMedia} max={10} />
                <button className="btn btn-primary" type="submit" disabled={posting} style={{ justifySelf: "start" }}>
                  {posting ? "Posting…" : "Publish post"}
                </button>
              </form>

              <button className="btn btn-ghost" onClick={() => setShowAdForm((v) => !v)} style={{ marginBottom: 12 }}>
                {showAdForm ? "Cancel" : "+ Run a political ad"}
              </button>
              {showAdForm && (
                <form onSubmit={createAd} className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
                  <select value={adForm.pageId} onChange={(e) => setAdForm({ ...adForm, pageId: e.target.value })} style={selectStyle}>
                    <option value="">Choose one of your pages…</option>
                    {myPages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input type="text" placeholder="Headline" value={adForm.headline} onChange={(e) => setAdForm({ ...adForm, headline: e.target.value })} />
                  <textarea rows={2} placeholder="Ad copy" value={adForm.body} onChange={(e) => setAdForm({ ...adForm, body: e.target.value })} />
                  <input type="text" placeholder="Destination URL (optional)" value={adForm.targetUrl} onChange={(e) => setAdForm({ ...adForm, targetUrl: e.target.value })} />
                  <div>
                    <input type="text" placeholder='Paid for by… (required)' value={adForm.paidForBy} onChange={(e) => setAdForm({ ...adForm, paidForBy: e.target.value })} />
                    <p style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 4 }}>
                      This appears on the ad itself and in the public archive. It can't be left blank.
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input type="text" placeholder="Spend (USD)" value={adForm.spend} onChange={(e) => setAdForm({ ...adForm, spend: e.target.value })} style={{ flex: 1, minWidth: 110 }} />
                    <input type="text" placeholder="Region" value={adForm.region} onChange={(e) => setAdForm({ ...adForm, region: e.target.value })} style={{ flex: 1, minWidth: 110 }} />
                  </div>
                  <MediaPicker files={adMedia} onChange={(f) => setAdMedia(f.slice(0, 1))} max={1} label="🎬 Ad creative (photo or video)" />
                  <button className="btn btn-primary" type="submit" disabled={creatingAd} style={{ justifySelf: "start" }}>
                    {creatingAd ? "Submitting…" : "Run ad"}
                  </button>
                </form>
              )}
            </>
          )}
        </>
      )}

      {tab === "archive" && (
        <>
          <div className="card" style={{ padding: 12, marginBottom: 14 }}>
            <p style={{ fontSize: 12, color: "var(--slate-300)", margin: 0, lineHeight: 1.5 }}>
              Every political ad ever run on NexgenSocial, including ones that have
              ended. Public and searchable by anyone, no account needed.
            </p>
          </div>

          <input type="text" placeholder="Search ads, sponsors, or funders…" value={archiveQuery}
            onChange={(e) => { setArchiveQuery(e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter") loadArchive(archiveQuery); }}
            style={{ marginBottom: 14 }} />

          {archive === null && <p style={{ color: "var(--slate-400)" }}>Loading archive…</p>}
          {archive?.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--slate-400)", fontSize: 13 }}>
              No political ads have been run yet.
            </div>
          )}
          {archive?.map((ad) => (
            <div key={ad.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span className="premium-pill">Political ad</span>
                <span className="eyebrow" style={{ fontSize: 10, color: ad.active ? "var(--cyan-300)" : "var(--slate-400)" }}>
                  {ad.active ? "Running" : "Ended"}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{ad.headline}</div>
              <div style={{ fontSize: 13, color: "var(--slate-300)", marginTop: 4 }}>{ad.body}</div>
              <MediaGallery
                media={ad.mediaUrl ? [{ id: ad.id, url: ad.mediaUrl, kind: ad.mediaKind || "PHOTO", position: 0 }] : []}
                legacyUrl={ad.imageUrl}
                compact
              />

              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--slate-400)", display: "grid", gap: 3 }}>
                <div><strong style={{ color: "var(--slate-300)" }}>Paid for by:</strong> {ad.paidForBy}</div>
                <div><strong style={{ color: "var(--slate-300)" }}>Page:</strong> {ad.page.name} ({ad.page.organization}){ad.page.verified ? " ✓" : " · unverified"}</div>
                <div>
                  Ran {new Date(ad.startedAt).toLocaleDateString()}
                  {ad.endedAt ? ` – ${new Date(ad.endedAt).toLocaleDateString()}` : " – present"}
                  {ad.region ? ` · ${ad.region}` : ""}
                </div>
                <div>
                  Declared spend: ${(ad.spendCents / 100).toFixed(2)} · {ad.impressions} impressions · {ad.clicks} clicks
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
