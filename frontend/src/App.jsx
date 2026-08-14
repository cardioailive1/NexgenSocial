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
import ProfileSetup from "./pages/ProfileSetup";
import Places from "./pages/Places";
import AdManager from "./pages/AdManager";
import Reels from "./pages/Reels";
import People from "./pages/People";
import Marketplace from "./pages/Marketplace";
import Political from "./pages/Political";
import Newsrooms from "./pages/Newsrooms";
import NewsroomDetail from "./pages/NewsroomDetail";
import Jobs from "./pages/Jobs";
import Messages from "./pages/Messages";
import Explore from "./pages/Explore";
import Meetings from "./pages/Meetings";
import MeetingRoom from "./pages/MeetingRoom";
import CallRoom from "./pages/CallRoom";
import IncomingCall from "./components/IncomingCall";
import LegalDoc from "./pages/LegalDoc";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

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
      <IncomingCall />
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
        <Route path="/profile-setup" element={<Protected><ProfileSetup /></Protected>} />
        <Route path="/places" element={<Protected><Places /></Protected>} />
        <Route path="/ads" element={<Protected><AdManager /></Protected>} />
        <Route path="/reels" element={<Protected><Reels /></Protected>} />
        <Route path="/people" element={<Protected><People /></Protected>} />
        <Route path="/marketplace" element={<Protected><Marketplace /></Protected>} />
        <Route path="/political" element={<Protected><Political /></Protected>} />
        <Route path="/newsrooms" element={<Protected><Newsrooms /></Protected>} />
        <Route path="/newsrooms/:slug" element={<Protected><NewsroomDetail /></Protected>} />
        <Route path="/jobs" element={<Protected><Jobs /></Protected>} />
        <Route path="/explore" element={<Protected><Explore /></Protected>} />
        <Route path="/meetings" element={<Protected><Meetings /></Protected>} />
        <Route path="/meet/:id" element={<Protected><MeetingRoom /></Protected>} />
        <Route path="/messages" element={<Protected><Messages /></Protected>} />
        <Route path="/call/:id" element={<Protected><CallRoom /></Protected>} />
        {/* Legal docs are intentionally NOT wrapped in <Protected> -- they
            must be readable before signing up, since acceptance is required
            to create an account in the first place. */}
        <Route path="/legal/:doc" element={<LegalDoc />} />
        {/* Both are reachable while signed out -- someone who can't sign in
            is exactly who needs them. */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
