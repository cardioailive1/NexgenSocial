import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Navbar from "./components/Navbar";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Feed from "./pages/Feed";
import Profile from "./pages/Profile";
import Friends from "./pages/Friends";
import Groups from "./pages/Groups";
import Premium from "./pages/Premium";
import Invite from "./pages/Invite";
import Connections from "./pages/Connections";
import Circles from "./pages/Circles";
import Wellbeing from "./pages/Wellbeing";
import { useScreenTime } from "./useScreenTime";
import Sports from "./pages/Sports";
import Celebrity from "./pages/Celebrity";
import BreakingNews from "./pages/BreakingNews";
import LiveStreams from "./pages/LiveStreams";
import LiveRoom from "./pages/LiveRoom";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="container" style={{ paddingTop: 60, textAlign: "center", color: "var(--slate-400)" }}>Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  useScreenTime();
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/" element={<Protected><Feed /></Protected>} />
        <Route path="/u/:username" element={<Protected><Profile /></Protected>} />
        <Route path="/friends" element={<Protected><Friends /></Protected>} />
        <Route path="/groups" element={<Protected><Groups /></Protected>} />
        <Route path="/groups/:id" element={<Protected><Groups /></Protected>} />
        <Route path="/premium" element={<Protected><Premium /></Protected>} />
        <Route path="/invite" element={<Protected><Invite /></Protected>} />
        <Route path="/connections" element={<Protected><Connections /></Protected>} />
        <Route path="/circles" element={<Protected><Circles /></Protected>} />
        <Route path="/wellbeing" element={<Protected><Wellbeing /></Protected>} />
        <Route path="/sports" element={<Protected><Sports /></Protected>} />
        <Route path="/celebrity" element={<Protected><Celebrity /></Protected>} />
        <Route path="/news" element={<Protected><BreakingNews /></Protected>} />
        <Route path="/live" element={<Protected><LiveStreams /></Protected>} />
        <Route path="/live/:id" element={<Protected><LiveRoom /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
