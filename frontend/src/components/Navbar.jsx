import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { api } from "../api";
import logo from "../assets/logo.jpg";

const navLinkStyle = ({ isActive }) => ({
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  color: isActive ? "var(--navy-950)" : "var(--slate-300)",
  background: isActive ? "var(--cyan-400)" : "transparent",
});

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header style={{ borderBottom: "1px solid var(--line)", position: "sticky", top: 0, background: "rgba(6,15,28,0.85)", backdropFilter: "blur(8px)", zIndex: 20 }}>
      <div className="container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, gap: 16 }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={logo} alt="Corverxis" style={{ height: 34, width: 34, borderRadius: 8, objectFit: "cover" }} />
          <div>
            <div className="h-display" style={{ fontSize: 16, lineHeight: 1 }}>NexgenSocial</div>
            <div className="eyebrow" style={{ fontSize: 9 }}>by Corverxis</div>
          </div>
        </Link>

        {user && (
          <nav style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center" }}>
            <NavLink to="/" style={navLinkStyle} end>Feed</NavLink>
            <NavLink to="/reels" style={navLinkStyle}>Reels</NavLink>
            <NavLink to="/groups" style={navLinkStyle}>Groups</NavLink>
            <NavLink to="/jobs" style={navLinkStyle}>Jobs</NavLink>
            <NavLink to="/marketplace" style={navLinkStyle}>Market</NavLink>
            <NavLink to="/political" style={navLinkStyle}>Political</NavLink>
            <NavLink to="/premium" style={navLinkStyle}>Premium</NavLink>
            <NavLink to="/people" style={navLinkStyle}>People</NavLink>
            <NavLink to="/friends" style={navLinkStyle}>Friends</NavLink>
            <NavLink to="/invite" style={navLinkStyle}>Invite</NavLink>
            <NavLink to="/connections" style={navLinkStyle}>Connections</NavLink>
            <NavLink to="/circles" style={navLinkStyle}>Circles</NavLink>
            <NavLink to="/wellbeing" style={navLinkStyle}>Wellbeing</NavLink>
            <NavLink to="/sports" style={navLinkStyle}>Sports</NavLink>
            <NavLink to="/celebrity" style={navLinkStyle}>Celebrity</NavLink>
            <NavLink to="/news" style={navLinkStyle}>News</NavLink>
            <NavLink to="/newsrooms" style={navLinkStyle}>Media</NavLink>
            <NavLink to="/live" style={navLinkStyle}>Live</NavLink>
            <NavLink to="/profile-setup" style={navLinkStyle}>My Profile</NavLink>
            <NavLink to="/places" style={navLinkStyle}>Places</NavLink>
            <NavLink to="/ads" style={navLinkStyle}>Ads</NavLink>
          </nav>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {user ? (
            <>
              <Link to={`/u/${user.username}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <img className="avatar" style={{ width: 30, height: 30 }} src={api.mediaUrl(user.avatarUrl) || `https://api.dicebear.com/7.x/identicon/svg?seed=${user.username}`} alt="" />
                <span style={{ fontSize: 13, fontWeight: 600 }}>{user.displayName}</span>
                {user.tier === "PREMIUM" && <span className="premium-pill">Premium</span>}
              </Link>
              <button className="btn btn-ghost" onClick={() => { logout(); navigate("/login"); }}>Sign out</button>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost" to="/login">Sign in</Link>
              <Link className="btn btn-primary" to="/signup">Join</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
