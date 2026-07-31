import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { MediaPicker, MediaGallery } from "../components/MediaAttach";

function VerifiedBadge({ verified }) {
  return verified
    ? <span className="premium-pill">✓ Verified</span>
    : <span className="premium-pill" style={{ background: "rgba(255,107,107,0.12)", color: "var(--danger)", borderColor: "rgba(255,107,107,0.3)" }}>Unverified</span>;
}

function ArticleCard({ article, showNewsroom }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="card" style={{ padding: 14, marginBottom: 10 }}>
      {article.isBreaking && (
        <span className="premium-pill" style={{ background: "rgba(255,107,107,0.15)", color: "var(--danger)", borderColor: "rgba(255,107,107,0.35)", marginBottom: 6, display: "inline-block" }}>
          ● Breaking
        </span>
      )}
      <div style={{ fontWeight: 700, fontSize: 15 }}>{article.headline}</div>
      {article.standfirst && <div style={{ fontSize: 13, color: "var(--slate-300)", marginTop: 4 }}>{article.standfirst}</div>}
      <MediaGallery media={article.media} legacyUrl={article.imageUrl} compact />

      {expanded && (
        <div style={{ fontSize: 13, lineHeight: 1.6, marginTop: 10, whiteSpace: "pre-wrap", color: "var(--slate-300)" }}>
          {article.body}
        </div>
      )}
      <button onClick={() => setExpanded((v) => !v)} style={{ fontSize: 12, color: "var(--cyan-300)", marginTop: 8 }}>
        {expanded ? "Show less" : "Read full story"}
      </button>

      <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {showNewsroom && article.newsroom && (
          <Link to={`/newsrooms/${article.newsroom.slug}`} style={{ color: "var(--slate-300)", fontWeight: 600 }}>
            {article.newsroom.name}
          </Link>
        )}
        {showNewsroom && article.newsroom && <VerifiedBadge verified={article.newsroom.verified} />}
        {article.byline && <span>By {article.byline}</span>}
        <span>{new Date(article.publishedAt).toLocaleString()}</span>
        {/* Corrections are shown, not hidden -- a story that quietly changes
            after publication is a trust problem. */}
        {article.correctedAt && (
          <span style={{ color: "var(--cyan-300)" }}>
            · Corrected {new Date(article.correctedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

export default function Newsrooms() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("coverage");
  const [articles, setArticles] = useState(null);
  const [newsrooms, setNewsrooms] = useState(null);
  const [myNewsrooms, setMyNewsrooms] = useState([]);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", organization: "", description: "", beat: "", region: "", websiteUrl: "" });
  const [creating, setCreating] = useState(false);
  const [newsroomAvatar, setNewsroomAvatar] = useState([]);
  const [newsroomCover, setNewsroomCover] = useState([]);
  const [newsroomMedia, setNewsroomMedia] = useState([]);
  const [articleMedia, setArticleMedia] = useState([]);

  const [showArticleForm, setShowArticleForm] = useState(false);
  const [article, setArticle] = useState({ newsroomId: "", headline: "", standfirst: "", body: "", byline: "", isBreaking: false });
  const [publishing, setPublishing] = useState(false);

  async function loadCoverage() {
    try {
      const { articles } = await api.get("/api/newsrooms/feed/latest");
      setArticles(articles);
    } catch (err) { setError(err.message); }
  }

  async function loadNewsrooms() {
    try {
      const { newsrooms } = await api.get("/api/newsrooms");
      setNewsrooms(newsrooms);
      setMyNewsrooms(newsrooms.filter((n) => n.owner?.username === user?.username));
    } catch (err) { setError(err.message); }
  }

  useEffect(() => { loadCoverage(); loadNewsrooms(); }, [user]);

  async function toggleFollow(n) {
    setBusyId(n.id);
    try {
      if (n.followedByViewer) await api.delete(`/api/newsrooms/${n.id}/follow`);
      else await api.post(`/api/newsrooms/${n.id}/follow`);
      await loadNewsrooms();
    } finally { setBusyId(null); }
  }

  async function createNewsroom(e) {
    e.preventDefault();
    if (!form.name || !form.organization) {
      setError("A newsroom name and the responsible organization are both required.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      // Was api.post with JSON, so the avatar never reached the server.
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (newsroomAvatar[0]) fd.append("avatar", newsroomAvatar[0]);
      if (newsroomCover[0]) fd.append("cover", newsroomCover[0]);
      newsroomMedia.forEach((f) => fd.append("media", f));
      await api.upload("/api/newsrooms", fd);
      setForm({ name: "", organization: "", description: "", beat: "", region: "", websiteUrl: "" });
      setNewsroomAvatar([]);
      setNewsroomCover([]);
      setNewsroomMedia([]);
      setShowForm(false);
      await loadNewsrooms();
    } catch (err) { setError(err.message); }
    finally { setCreating(false); }
  }

  async function publishArticle(e) {
    e.preventDefault();
    if (!article.newsroomId || !article.headline || !article.body) {
      setError("Choose a newsroom, and write a headline and body.");
      return;
    }
    setPublishing(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("headline", article.headline);
      fd.append("standfirst", article.standfirst);
      fd.append("body", article.body);
      fd.append("byline", article.byline);
      fd.append("isBreaking", String(article.isBreaking));
      articleMedia.forEach((f) => fd.append("media", f));
      await api.upload(`/api/newsrooms/${article.newsroomId}/articles`, fd);
      setArticle({ newsroomId: "", headline: "", standfirst: "", body: "", byline: "", isBreaking: false });
      setArticleMedia([]);
      setShowArticleForm(false);
      await loadCoverage();
      setTab("coverage");
    } catch (err) { setError(err.message); }
    finally { setPublishing(false); }
  }

  async function goLiveAs(newsroomId) {
    try {
      const { stream } = await api.post("/api/livestreams", {
        title: `Live broadcast`,
        newsroomId,
      });
      navigate(`/live/${stream.id}`);
    } catch (err) { setError(err.message); }
  }

  const selectStyle = {
    width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid var(--line)",
    background: "var(--navy-950)", color: "var(--white)", fontSize: 13,
  };

  return (
    <div className="container" style={{ maxWidth: 700, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Media Coverage</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 16 }}>
        Newsrooms publishing here, plus their live broadcasts. For headlines
        from outside outlets, see <Link to="/news" style={{ color: "var(--cyan-300)" }}>Breaking News</Link>.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["coverage", "Coverage"], ["newsrooms", "Newsrooms"], ["publish", "Publish"]].map(([k, l]) => (
          <button key={k} className="btn" onClick={() => setTab(k)}
            style={{
              background: tab === k ? "var(--cyan-400)" : "var(--navy-800)",
              color: tab === k ? "var(--navy-950)" : "var(--slate-300)",
              border: "1px solid var(--line)",
            }}>
            {l}
          </button>
        ))}
      </div>

      {error && <div className="card" style={{ padding: 12, color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {tab === "coverage" && (
        <>
          {articles === null && <p style={{ color: "var(--slate-400)" }}>Loading coverage…</p>}
          {articles?.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--slate-400)", fontSize: 13 }}>
              No stories published yet. Create a newsroom to start publishing.
            </div>
          )}
          {articles?.map((a) => <ArticleCard key={a.id} article={a} showNewsroom />)}
        </>
      )}

      {tab === "newsrooms" && (
        <>
          {newsrooms === null && <p style={{ color: "var(--slate-400)" }}>Loading…</p>}
          {newsrooms?.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--slate-400)", fontSize: 13 }}>
              No newsrooms yet.
            </div>
          )}
          {newsrooms?.map((n) => (
            <div key={n.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <img className="avatar" style={{ width: 44, height: 44 }}
                  src={api.mediaUrl(n.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${n.slug}`} alt="" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <Link to={`/newsrooms/${n.slug}`} style={{ fontWeight: 700, fontSize: 14 }}>{n.name}</Link>
                    <VerifiedBadge verified={n.verified} />
                    {n.liveNow && (
                      <Link to={`/live/${n.liveNow.id}`} className="premium-pill"
                        style={{ background: "rgba(255,107,107,0.15)", color: "var(--danger)", borderColor: "rgba(255,107,107,0.35)" }}>
                        ● LIVE
                      </Link>
                    )}
                  </div>
                  {n.description && <div style={{ fontSize: 12, color: "var(--slate-300)", marginTop: 4 }}>{n.description}</div>}
                  <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 6 }}>
                    Published by <strong style={{ color: "var(--slate-300)" }}>{n.organization}</strong>
                    {n.beat ? ` · ${n.beat}` : ""}{n.region ? ` · ${n.region}` : ""}
                  </div>
                  <div className="eyebrow" style={{ fontSize: 10, marginTop: 6 }}>
                    {n.articleCount} stories · {n.followerCount} followers
                    {n.media?.length ? ` · ${n.media.length} media` : ""}
                  </div>
                  {n.media?.length > 0 && <MediaGallery media={n.media} compact />}
                </div>
                <button className={n.followedByViewer ? "btn btn-ghost" : "btn btn-primary"}
                  disabled={busyId === n.id} onClick={() => toggleFollow(n)} style={{ fontSize: 11, padding: "6px 10px" }}>
                  {n.followedByViewer ? "Following" : "Follow"}
                </button>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === "publish" && (
        <>
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)} style={{ marginBottom: 12 }}>
            {showForm ? "Cancel" : "+ Create a newsroom"}
          </button>

          {showForm && (
            <form onSubmit={createNewsroom} className="card" style={{ padding: 16, marginBottom: 20, display: "grid", gap: 10 }}>
              <input type="text" placeholder="Newsroom name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input type="text" placeholder="Responsible organization (required, shown publicly)" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} />
              <textarea rows={2} placeholder="What does this newsroom cover?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input type="text" placeholder="Beat (e.g. Politics)" value={form.beat} onChange={(e) => setForm({ ...form, beat: e.target.value })} style={{ flex: 1, minWidth: 120 }} />
                <input type="text" placeholder="Region" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} style={{ flex: 1, minWidth: 120 }} />
              </div>
              <input type="text" placeholder="Website (optional)" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} />
              <MediaPicker files={newsroomAvatar} onChange={(f) => setNewsroomAvatar(f.slice(0, 1))} max={1} label="🖼 Newsroom logo" />
              <MediaPicker files={newsroomCover} onChange={(f) => setNewsroomCover(f.slice(0, 1))} max={1} label="🏞 Cover image" />
              <div>
                <MediaPicker files={newsroomMedia} onChange={setNewsroomMedia} max={10} label="📷 Photos & videos for this newsroom" />
                <p style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 6, lineHeight: 1.5 }}>
                  Studio shots, team photos, a channel trailer — anything that
                  belongs to the newsroom itself rather than to one story. Story
                  images are attached when you publish each piece.
                </p>
              </div>
              <button className="btn btn-primary" type="submit" disabled={creating} style={{ justifySelf: "start" }}>
                {creating ? "Creating…" : "Create newsroom"}
              </button>
            </form>
          )}

          {myNewsrooms.length > 0 && (
            <>
              <h2 className="eyebrow" style={{ marginBottom: 10 }}>Your newsrooms</h2>
              {myNewsrooms.map((n) => (
                <div key={n.id} className="card" style={{ padding: 14, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{n.name}</div>
                    <div style={{ fontSize: 11, color: "var(--slate-400)" }}>{n.articleCount} stories</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost" onClick={() => goLiveAs(n.id)} style={{ fontSize: 11, padding: "6px 10px" }}>
                      ● Go live as {n.name}
                    </button>
                  </div>
                </div>
              ))}

              <button className="btn btn-primary" onClick={() => setShowArticleForm((v) => !v)} style={{ marginTop: 8, marginBottom: 12 }}>
                {showArticleForm ? "Cancel" : "+ Publish a story"}
              </button>

              {showArticleForm && (
                <form onSubmit={publishArticle} className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
                  <select value={article.newsroomId} onChange={(e) => setArticle({ ...article, newsroomId: e.target.value })} style={selectStyle}>
                    <option value="">Publish from…</option>
                    {myNewsrooms.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                  <input type="text" placeholder="Headline" value={article.headline} onChange={(e) => setArticle({ ...article, headline: e.target.value })} />
                  <input type="text" placeholder="Standfirst / summary (optional)" value={article.standfirst} onChange={(e) => setArticle({ ...article, standfirst: e.target.value })} />
                  <textarea rows={6} placeholder="Story body" value={article.body} onChange={(e) => setArticle({ ...article, body: e.target.value })} />
                  <input type="text" placeholder="Byline (optional)" value={article.byline} onChange={(e) => setArticle({ ...article, byline: e.target.value })} />
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--slate-300)" }}>
                    <input type="checkbox" checked={article.isBreaking} onChange={(e) => setArticle({ ...article, isBreaking: e.target.checked })} />
                    Mark as breaking
                  </label>
                  <MediaPicker files={articleMedia} onChange={setArticleMedia} max={10} label="📷 Add photos & video to this story" />
                  <button className="btn btn-primary" type="submit" disabled={publishing} style={{ justifySelf: "start" }}>
                    {publishing ? "Publishing…" : "Publish story"}
                  </button>
                </form>
              )}
            </>
          )}

          {myNewsrooms.length === 0 && !showForm && (
            <p style={{ color: "var(--slate-400)", fontSize: 13 }}>
              Create a newsroom to publish stories and broadcast live under its name.
            </p>
          )}
        </>
      )}
    </div>
  );
}
