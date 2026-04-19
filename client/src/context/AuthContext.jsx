import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const storeToken = useCallback((token) => {
    localStorage.setItem("auth_token", token);
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }, []);

  const clearToken = useCallback(() => {
    localStorage.removeItem("auth_token");
    delete api.defaults.headers.common["Authorization"];
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      api.get("/auth/me")
        .then((res) => setUser(res.data))
        .catch(() => { clearToken(); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [clearToken]);

  const login = useCallback(async (email, password) => {
    const res = await api.post("/auth/login", { email, password });
    storeToken(res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  }, [storeToken]);

  const register = useCallback(async (email, password, name) => {
    const res = await api.post("/auth/register", { email, password, name });
    storeToken(res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  }, [storeToken]);

  const loginWithToken = useCallback(async (token) => {
    storeToken(token);
    const res = await api.get("/auth/me");
    setUser(res.data);
    return res.data;
  }, [storeToken]);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, [clearToken]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithToken, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
