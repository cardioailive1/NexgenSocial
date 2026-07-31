import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

const EMPLOYMENT_TYPES = [
  ["FULL_TIME", "Full time"], ["PART_TIME", "Part time"], ["CONTRACT", "Contract"],
  ["INTERNSHIP", "Internship"], ["TEMPORARY", "Temporary"], ["VOLUNTEER", "Volunteer"],
];
const ARRANGEMENTS = [["ONSITE", "On-site"], ["HYBRID", "Hybrid"], ["REMOTE", "Remote"]];
const APP_STATUSES = ["SUBMITTED", "REVIEWING", "INTERVIEWING", "OFFERED", "REJECTED"];

function salaryText(job) {
  if (!job.salaryMin && !job.salaryMax) return null;
  const cur = job.salaryCurrency || "USD";
  const per = { YEAR: "/yr", MONTH: "/mo", HOUR: "/hr" }[job.salaryPeriod] || "";
  const fmt = (n) => n?.toLocaleString();
  if (job.salaryMin && job.salaryMax) return `${cur} ${fmt(job.salaryMin)}–${fmt(job.salaryMax)}${per}`;
  return `${cur} ${fmt(job.salaryMin || job.salaryMax)}${per}`;
}

function ApplyForm({ job, onDone, onCancel }) {
  const [coverLetter, setCoverLetter] = useState("");
  const [resume, setResume] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("coverLetter", coverLetter);
      if (resume) fd.append("resume", resume);
      await api.upload(`/api/jobs/${job.id}/apply`, fd);
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)", display: "grid", gap: 10 }}>
      <textarea rows={4} placeholder="Cover letter — why you're a fit" value={coverLetter} onChange={(e) => setCoverLetter(e.target.value)} />
      <label className="btn btn-ghost" style={{ fontSize: 12, justifySelf: "start" }}>
        📄 Attach resume (PDF or Word)
        <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setResume(e.target.files[0])} style={{ display: "none" }} />
      </label>
      {resume && <div style={{ fontSize: 11, color: "var(--slate-400)" }}>{resume.name}</div>}
      {error && <div style={{ color: "var(--danger)", fontSize: 12 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-ghost" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? "Submitting…" : "Submit application"}</button>
      </div>
    </form>
  );
}

export default function Jobs() {
  const { user } = useAuth();
  const [tab, setTab] = useState("browse");
  const [jobs, setJobs] = useState(null);
  const [filters, setFilters] = useState({ q: "", arrangement: "", employmentType: "", location: "", minSalary: "" });
  const [applyingTo, setApplyingTo] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [error, setError] = useState("");

  const [myJobs, setMyJobs] = useState([]);
  const [myApps, setMyApps] = useState([]);
  const [applicants, setApplicants] = useState({});

  const [showPost, setShowPost] = useState(false);
  const [post, setPost] = useState({
    title: "", companyName: "", description: "", responsibilities: "", requirements: "",
    location: "", arrangement: "ONSITE", employmentType: "FULL_TIME",
    salaryMin: "", salaryMax: "", salaryCurrency: "USD", salaryPeriod: "YEAR", applyUrl: "",
  });
  const [posting, setPosting] = useState(false);

  async function loadJobs() {
    setError("");
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
      const { jobs } = await api.get(`/api/jobs${params.toString() ? `?${params}` : ""}`);
      setJobs(jobs);
    } catch (err) { setError(err.message); }
  }

  async function loadMine() {
    try {
      const [{ jobs }, { applications }] = await Promise.all([
        api.get("/api/jobs/mine"),
        api.get("/api/jobs/applications/mine"),
      ]);
      setMyJobs(jobs);
      setMyApps(applications);
    } catch (err) { setError(err.message); }
  }

  useEffect(() => { loadJobs(); loadMine(); }, []);
  useEffect(() => { const t = setTimeout(loadJobs, 350); return () => clearTimeout(t); }, [filters]);

  async function loadApplicants(jobId) {
    try {
      const { applications } = await api.get(`/api/jobs/${jobId}/applications`);
      setApplicants((s) => ({ ...s, [jobId]: applications }));
    } catch (err) { setError(err.message); }
  }

  async function setAppStatus(applicationId, status, jobId) {
    await api.patch(`/api/jobs/applications/${applicationId}`, { status });
    await loadApplicants(jobId);
  }

  async function withdraw(applicationId) {
    await api.patch(`/api/jobs/applications/${applicationId}`, { status: "WITHDRAWN" });
    await loadMine();
  }

  async function submitPost(e) {
    e.preventDefault();
    if (!post.title || !post.companyName || !post.description) {
      setError("Job title, company name, and description are required.");
      return;
    }
    setPosting(true);
    setError("");
    try {
      const fd = new FormData();
      Object.entries(post).forEach(([k, v]) => { if (v !== "") fd.append(k, v); });
      await api.upload("/api/jobs", fd);
      setPost({ ...post, title: "", description: "", responsibilities: "", requirements: "", salaryMin: "", salaryMax: "" });
      setShowPost(false);
      await Promise.all([loadJobs(), loadMine()]);
      setTab("manage");
    } catch (err) { setError(err.message); }
    finally { setPosting(false); }
  }

  const selectStyle = {
    padding: "8px 11px", borderRadius: 10, border: "1px solid var(--line)",
    background: "var(--navy-950)", color: "var(--white)", fontSize: 13,
  };

  return (
    <div className="container" style={{ maxWidth: 720, paddingTop: 28, paddingBottom: 60 }}>
      <h1 className="h-display" style={{ fontSize: 22, marginBottom: 4 }}>Jobs</h1>
      <p style={{ color: "var(--slate-400)", fontSize: 14, marginBottom: 16 }}>
        Find work, or hire. Never pay to apply for a job — any request for money
        or bank details is a fraud signal.
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {[["browse", "Browse"], ["applications", `My applications (${myApps.length})`], ["manage", `My postings (${myJobs.length})`], ["post", "Post a job"]].map(([k, l]) => (
          <button key={k} className="btn" onClick={() => setTab(k)}
            style={{ background: tab === k ? "var(--cyan-400)" : "var(--navy-800)", color: tab === k ? "var(--navy-950)" : "var(--slate-300)", border: "1px solid var(--line)", fontSize: 12 }}>
            {l}
          </button>
        ))}
      </div>

      {error && <div className="card" style={{ padding: 12, color: "var(--danger)", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {tab === "browse" && (
        <>
          <div className="card" style={{ padding: 14, marginBottom: 16, display: "grid", gap: 10 }}>
            <input type="text" placeholder="Search title, company, or keywords…" value={filters.q}
              onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <select value={filters.arrangement} onChange={(e) => setFilters({ ...filters, arrangement: e.target.value })} style={selectStyle}>
                <option value="">Any arrangement</option>
                {ARRANGEMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select value={filters.employmentType} onChange={(e) => setFilters({ ...filters, employmentType: e.target.value })} style={selectStyle}>
                <option value="">Any type</option>
                {EMPLOYMENT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="text" placeholder="Location" value={filters.location}
                onChange={(e) => setFilters({ ...filters, location: e.target.value })} style={{ flex: 1, minWidth: 110 }} />
              <input type="text" placeholder="Min salary" value={filters.minSalary}
                onChange={(e) => setFilters({ ...filters, minSalary: e.target.value })} style={{ flex: 1, minWidth: 100 }} />
            </div>
          </div>

          {jobs === null && <p style={{ color: "var(--slate-400)" }}>Loading jobs…</p>}
          {jobs?.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--slate-400)", fontSize: 13 }}>
              No jobs match. Try widening your filters.
            </div>
          )}

          {jobs?.map((job) => (
            <div key={job.id} className="card" style={{ padding: 16, marginBottom: 10 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {job.companyLogoUrl && (
                  <img src={api.mediaUrl(job.companyLogoUrl)} alt="" style={{ width: 42, height: 42, borderRadius: 8, objectFit: "cover", border: "1px solid var(--line)" }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{job.title}</div>
                  <div style={{ fontSize: 13, color: "var(--slate-300)" }}>{job.companyName}</div>
                  <div style={{ fontSize: 12, color: "var(--slate-400)", marginTop: 4, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {job.location && <span>{job.location}</span>}
                    <span>· {ARRANGEMENTS.find(([v]) => v === job.arrangement)?.[1]}</span>
                    <span>· {EMPLOYMENT_TYPES.find(([v]) => v === job.employmentType)?.[1]}</span>
                  </div>
                  {salaryText(job) ? (
                    <div style={{ fontSize: 13, color: "var(--cyan-300)", marginTop: 6, fontWeight: 600 }}>{salaryText(job)}</div>
                  ) : (
                    <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 6 }}>Salary not disclosed</div>
                  )}
                </div>
              </div>

              {expanded === job.id && (
                <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, color: "var(--slate-300)" }}>
                  <div style={{ whiteSpace: "pre-wrap" }}>{job.description}</div>
                  {job.responsibilities && (<><div className="eyebrow" style={{ marginTop: 12, marginBottom: 4 }}>Responsibilities</div><div style={{ whiteSpace: "pre-wrap" }}>{job.responsibilities}</div></>)}
                  {job.requirements && (<><div className="eyebrow" style={{ marginTop: 12, marginBottom: 4 }}>Requirements</div><div style={{ whiteSpace: "pre-wrap" }}>{job.requirements}</div></>)}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                <button onClick={() => setExpanded(expanded === job.id ? null : job.id)} style={{ fontSize: 12, color: "var(--cyan-300)" }}>
                  {expanded === job.id ? "Show less" : "View details"}
                </button>
                {job.isOwner ? (
                  <span className="eyebrow" style={{ fontSize: 10 }}>Your posting</span>
                ) : job.appliedByViewer ? (
                  <span className="premium-pill">Applied ✓</span>
                ) : job.applyUrl ? (
                  <a href={job.applyUrl} target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ fontSize: 11, padding: "6px 10px" }}>
                    Apply on company site ↗
                  </a>
                ) : (
                  <button className="btn btn-primary" onClick={() => setApplyingTo(applyingTo === job.id ? null : job.id)} style={{ fontSize: 11, padding: "6px 10px" }}>
                    Apply
                  </button>
                )}
                <span style={{ fontSize: 11, color: "var(--slate-400)" }}>
                  Posted {new Date(job.createdAt).toLocaleDateString()}
                </span>
              </div>

              {applyingTo === job.id && (
                <ApplyForm job={job} onCancel={() => setApplyingTo(null)}
                  onDone={async () => { setApplyingTo(null); await Promise.all([loadJobs(), loadMine()]); }} />
              )}
            </div>
          ))}
        </>
      )}

      {tab === "applications" && (
        <>
          {myApps.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--slate-400)", fontSize: 13 }}>
              You haven't applied to anything yet.
            </div>
          )}
          {myApps.map((a) => (
            <div key={a.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{a.job.title}</div>
                  <div style={{ fontSize: 12, color: "var(--slate-400)" }}>{a.job.companyName} · {a.job.location || "—"}</div>
                  <div style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 4 }}>
                    Applied {new Date(a.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span className="premium-pill">{a.status}</span>
                  {!["WITHDRAWN", "REJECTED"].includes(a.status) && (
                    <button className="btn btn-ghost btn-danger" onClick={() => withdraw(a.id)} style={{ fontSize: 11, padding: "5px 9px" }}>
                      Withdraw
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {tab === "manage" && (
        <>
          {myJobs.length === 0 && (
            <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--slate-400)", fontSize: 13 }}>
              You haven't posted any jobs yet.
            </div>
          )}
          {myJobs.map((job) => (
            <div key={job.id} className="card" style={{ padding: 14, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{job.title}</div>
                  <div style={{ fontSize: 12, color: "var(--slate-400)" }}>
                    {job.applicationCount} applicant{job.applicationCount === 1 ? "" : "s"} · {job.status}
                  </div>
                </div>
                <button className="btn btn-ghost" onClick={() => loadApplicants(job.id)} style={{ fontSize: 11, padding: "6px 10px" }}>
                  View applicants
                </button>
              </div>

              {applicants[job.id] && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                  {applicants[job.id].length === 0 && <p style={{ fontSize: 12, color: "var(--slate-400)" }}>No applicants yet.</p>}
                  {applicants[job.id].map((a) => (
                    <div key={a.id} style={{ padding: 10, background: "var(--navy-950)", border: "1px solid var(--line)", borderRadius: 8, marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{a.applicant.displayName} <span style={{ color: "var(--slate-400)", fontWeight: 400 }}>@{a.applicant.username}</span></div>
                          {a.applicant.occupation && <div style={{ fontSize: 11, color: "var(--slate-400)" }}>{a.applicant.occupation}</div>}
                        </div>
                        <select value={a.status} onChange={(e) => setAppStatus(a.id, e.target.value, job.id)} style={{ ...selectStyle, fontSize: 11, padding: "5px 8px" }}>
                          {APP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      {a.coverLetter && <div style={{ fontSize: 12, color: "var(--slate-300)", marginTop: 6, whiteSpace: "pre-wrap" }}>{a.coverLetter}</div>}
                      {a.resumeUrl && (
                        <a href={api.mediaUrl(a.resumeUrl)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "var(--cyan-300)", display: "inline-block", marginTop: 6 }}>
                          📄 Download resume ↗
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {tab === "post" && (
        <form onSubmit={submitPost} className="card" style={{ padding: 16, display: "grid", gap: 10 }}>
          <h2 className="eyebrow">Post a job</h2>
          <input type="text" placeholder="Job title" value={post.title} onChange={(e) => setPost({ ...post, title: e.target.value })} />
          <input type="text" placeholder="Company name" value={post.companyName} onChange={(e) => setPost({ ...post, companyName: e.target.value })} />
          <textarea rows={4} placeholder="Job description" value={post.description} onChange={(e) => setPost({ ...post, description: e.target.value })} />
          <textarea rows={3} placeholder="Responsibilities (optional)" value={post.responsibilities} onChange={(e) => setPost({ ...post, responsibilities: e.target.value })} />
          <textarea rows={3} placeholder="Requirements (optional)" value={post.requirements} onChange={(e) => setPost({ ...post, requirements: e.target.value })} />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input type="text" placeholder="Location" value={post.location} onChange={(e) => setPost({ ...post, location: e.target.value })} style={{ flex: 1, minWidth: 130 }} />
            <select value={post.arrangement} onChange={(e) => setPost({ ...post, arrangement: e.target.value })} style={selectStyle}>
              {ARRANGEMENTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={post.employmentType} onChange={(e) => setPost({ ...post, employmentType: e.target.value })} style={selectStyle}>
              {EMPLOYMENT_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>

          <div>
            <div className="eyebrow" style={{ fontSize: 10, marginBottom: 6 }}>Salary range</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input type="text" placeholder="Min" value={post.salaryMin} onChange={(e) => setPost({ ...post, salaryMin: e.target.value })} style={{ flex: 1, minWidth: 90 }} />
              <input type="text" placeholder="Max" value={post.salaryMax} onChange={(e) => setPost({ ...post, salaryMax: e.target.value })} style={{ flex: 1, minWidth: 90 }} />
              <select value={post.salaryPeriod} onChange={(e) => setPost({ ...post, salaryPeriod: e.target.value })} style={selectStyle}>
                <option value="YEAR">per year</option>
                <option value="MONTH">per month</option>
                <option value="HOUR">per hour</option>
              </select>
            </div>
            <p style={{ fontSize: 11, color: "var(--slate-400)", marginTop: 6, lineHeight: 1.5 }}>
              Several jurisdictions — including California, Colorado, New York and
              Washington — legally require a good-faith salary range in job
              postings, and comparable rules apply in the EU. Check what applies
              where this role is located.
            </p>
          </div>

          <input type="text" placeholder="External application URL (optional)" value={post.applyUrl} onChange={(e) => setPost({ ...post, applyUrl: e.target.value })} />

          <div className="card" style={{ padding: 12, background: "var(--navy-950)" }}>
            <p style={{ fontSize: 11, color: "var(--slate-400)", margin: 0, lineHeight: 1.5 }}>
              By posting you confirm this is a genuine, currently available role,
              that it does not discriminate on any legally protected
              characteristic, and that you will handle applicant data lawfully.
            </p>
          </div>

          <button className="btn btn-primary" type="submit" disabled={posting} style={{ justifySelf: "start" }}>
            {posting ? "Posting…" : "Post job"}
          </button>
        </form>
      )}
    </div>
  );
}
