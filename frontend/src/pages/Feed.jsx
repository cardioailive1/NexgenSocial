import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import PostCard from "../components/PostCard";
import QuickVideoRecorder from "../components/QuickVideoRecorder";
import SponsoredCard from "../components/SponsoredCard";
import ProfileAlert from "../components/ProfileAlert";
import PushPrompt from "../components/PushPrompt";
import FriendSuggestions from "../components/FriendSuggestions";
import { useAuth } from "../AuthContext";

const DEFAULT_WEIGHTS = { recency: 0.5, engagement: 0.3, diversity: 0.2 };

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState(null);
  const [ads, setAds] = useState([]);
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [audience, setAudience] = useState("PUBLIC");
  const [category, setCategory] = useState("GENERAL");
  const [circles, setCircles] = useState([]);
  const [circleId, setCircleId] = useState("");
  const [isAiGenerated, setIsAiGenerated] = useState(false);
  const [aiTool, setAiTool] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");
  const [showTuning, setShowTuning] = useState(false);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const fileRef = useRef();

  async function load() {
    const { posts, feedWeights } = await api.get("/api/posts/feed");
    setPosts(posts);
    if (feedWeights) setWeights(feedWeights);
    // Ads are fetched separately so a failure here (or an empty ad
    // inventory) never blocks the actual feed from rendering.
    api.get("/api/ads/serve?limit=3").then(({ ads }) => setAds(ads)).catch(() => setAds([]));
  }

  useEffect(() => {
    load();
    api.get("/api/circles").then(({ circles }) => setCircles(circles)).catch(() => {});
  }, []);

  async function submitPost(e) {
    e.preventDefault();
    if (!body.trim() && !file) return;
    setPosting(true);
    setError("");
    try {
      const formData = new FormData();
      if (body) formData.append("body", body);
      if (file) formData.append("media", file);
      formData.append("audience", audience);
      formData.append("category", category);
      if (audience === "CIRCLE" && circleId) formData.append("circleId", circleId);
      if (isAiGenerated) {
        formData.append("isAiGenerated", "true");
        if (aiTool) formData.append("aiTool", aiTool);
      }
      await api.upload("/api/posts", formData);
      setBody("");
      setFile(null);
      setIsAiGenerated(false);
      setAiTool("");
      if (fileRef.current) fileRef.current.value = "";
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setPosting(false);
    }
  }

  async function saveWeights() {
    const { feedWeights } = await api.patch("/api/users/me/feed-weights", weights);
    setWeights(feedWeights);
    load();
  }

  function updateWeight(key, value) {
    setWeights((w) => ({ ...w, [key]: Number(value) }));
  }

  return (
    <div className="container" style={{ maxWidth: 640, paddingTop: 28, paddingBottom: 60 }}>
      <PushPrompt />
      <ProfileAlert />
      <FriendSuggestions limit={4} />

      <div className="card" style={{ padding: 12, marginBottom: 20 }}>
        <button onClick={() => setShowTuning((v) => !v)} style={{ fontSize: 12, fontWeight: 600, color: "var(--cyan-300)", width: "100%", textAlign: "left" }}>
          ⚙ Tune my feed algorithm {showTuning ? "▲" : "▼"}
        </button>
        {showTuning && (
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            {["recency", "engagement", "diversity"].map((key) => (
              <div key={key}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--slate-300)", marginBottom: 4 }}>
                  <span style={{ textTransform: "capitalize" }}>{key}</span>
                  <span>{weights[key].toFixed(2)}</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={weights[key]} onChange={(e) => updateWeight(key, e.target.value)} style={{ width: "100%" }} />
              </div>
            ))}
            <p style={{ fontSize: 11, color: "var(--slate-400)", margin: 0 }}>
              Recency favors newer posts. Engagement favors more-liked/commented posts.
              Diversity spreads out posts from the same author instead of letting one voice dominate the top.
            </p>
            <button className="btn btn-primary" onClick={saveWeights} style={{ justifySelf: "start" }}>Apply</button>
          </div>
        )}
      </div>

      <form onSubmit={submitPost} className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <img className="avatar" src={api.mediaUrl(user?.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${user?.username}`} alt="" />
          <textarea
            placeholder="Start a thread…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
          <select value={audience} onChange={(e) => setAudience(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--navy-950)", color: "var(--white)" }}>
            <option value="PUBLIC">🌐 Public</option>
            <option value="FRIENDS">Friends only</option>
            <option value="FOLLOWERS">Followers only</option>
            <option value="CIRCLE">Custom circle…</option>
          </select>
          <select value={category} onChange={(e) => setCategory(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--navy-950)", color: "var(--white)" }}>
            <option value="GENERAL">General</option>
            <option value="SPORTS">Sports</option>
            <option value="CELEBRITY">Celebrity</option>
            <option value="NEWS">News</option>
          </select>
          {audience === "CIRCLE" && (
            <select value={circleId} onChange={(e) => setCircleId(e.target.value)} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--navy-950)", color: "var(--white)" }}>
              <option value="">Choose a circle…</option>
              {circles.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>

        {file && (
          <div style={{ fontSize: 12, color: "var(--slate-400)", marginTop: 8 }}>
            Attached: {file.name} <button type="button" onClick={() => { setFile(null); fileRef.current.value = ""; }} style={{ color: "var(--danger)", marginLeft: 6 }}>remove</button>
            <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
              <input type="checkbox" checked={isAiGenerated} onChange={(e) => setIsAiGenerated(e.target.checked)} />
              This media is AI-generated
            </label>
            {isAiGenerated && (
              <input type="text" placeholder="Which tool? (optional)" value={aiTool} onChange={(e) => setAiTool(e.target.value)} style={{ marginTop: 6, fontSize: 12 }} />
            )}
          </div>
        )}
        {error && <div style={{ color: "var(--danger)", fontSize: 13, marginTop: 8 }}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <label className="btn btn-ghost" style={{ fontSize: 13 }}>
              📎 Add photo / video
              <input ref={fileRef} type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files[0])} style={{ display: "none" }} />
            </label>
            <QuickVideoRecorder onPosted={load} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={posting}>{posting ? "Posting…" : "Post thread"}</button>
        </div>
      </form>

      {posts === null && <p style={{ color: "var(--slate-400)" }}>Loading your feed…</p>}
      {posts?.length === 0 && (
        <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--slate-400)" }}>
          Your feed is quiet. Follow people or post the first thread.
        </div>
      )}
      {/* Interleave a sponsored card after every 3rd post rather than
          stacking them at the top -- less intrusive, and ads at the very top
          of a feed read as spam. */}
      {posts?.map((post, i) => (
        <div key={post.id}>
          <PostCard post={post} viewerUsername={user?.username} onChanged={load} />
          {ads.length > 0 && (i + 1) % 3 === 0 && (
            <SponsoredCard ad={ads[(Math.floor((i + 1) / 3) - 1) % ads.length]} />
          )}
        </div>
      ))}
    </div>
  );
}
