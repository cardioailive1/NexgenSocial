import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("ngs_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const { user } = await api.get("/api/auth/me");
      setUser(user);
    } catch {
      localStorage.removeItem("ngs_token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function login(token, user) {
    localStorage.setItem("ngs_token", token);
    setUser(user);
  }

  function logout() {
    localStorage.removeItem("ngs_token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
