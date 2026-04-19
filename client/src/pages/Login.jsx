import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../api";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState("signin"); // "signin" | "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (tab === "signin") {
        await login(email, password);
      } else {
        if (password.length < 6) { setError("Password must be at least 6 characters"); setSubmitting(false); return; }
        await register(email, password, name);
      }
      navigate("/trends", { replace: true });
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || "Something went wrong";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleLogin() {
    try {
      const res = await api.get("/auth/google/authorize");
      window.location.href = res.data.url;
    } catch (err) {
      setError(err?.response?.data?.detail || "Google OAuth not configured");
    }
  }

  async function handleTwitterLogin() {
    try {
      const res = await api.get("/auth/twitter/authorize");
      window.location.href = res.data.url;
    } catch (err) {
      setError(err?.response?.data?.detail || "Twitter OAuth not configured");
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--navy)",
      padding: "20px",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        background: "var(--navy-light)",
        borderRadius: 16,
        border: "1px solid var(--border)",
        padding: "36px 32px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}>
        {/* Logo + Title */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img
            src="/5500_logo.png"
            alt="logo"
            style={{ width: 48, height: 48, borderRadius: 10, marginBottom: 12 }}
          />
          <h1 style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--white)", margin: 0 }}>
            NYC Subway Analytics
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginTop: 4 }}>
            Sign in to access the dashboard
          </p>
        </div>

        {/* Tab switcher */}
        <div style={{
          display: "flex",
          background: "var(--navy)",
          borderRadius: 8,
          padding: 4,
          marginBottom: 24,
          border: "1px solid var(--border)",
        }}>
          {["signin", "register"].map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: "0.875rem",
                fontWeight: 500,
                background: tab === t ? "var(--accent-light)" : "transparent",
                color: tab === t ? "var(--white)" : "var(--text-secondary)",
                transition: "all 0.15s",
              }}
            >
              {t === "signin" ? "Sign In" : "Create Account"}
            </button>
          ))}
        </div>

        {/* OAuth buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          <button
            onClick={handleGoogleLogin}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 0",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--navy)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
          >
            <GoogleIcon />
            Google
          </button>
          <button
            onClick={handleTwitterLogin}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "10px 0",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--navy)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: "0.875rem",
              fontWeight: 500,
              transition: "border-color 0.15s",
            }}
            onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent)"}
            onMouseLeave={(e) => e.currentTarget.style.borderColor = "var(--border)"}
          >
            <XIcon />
            X / Twitter
          </button>
        </div>

        {/* Divider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>or continue with email</span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit}>
          {tab === "register" && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 6 }}>
                Name (optional)
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                style={inputStyle}
              />
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-secondary)", marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 8,
              padding: "10px 12px",
              marginBottom: 16,
              color: "#ef4444",
              fontSize: "0.8rem",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ width: "100%", padding: "11px 0", fontSize: "0.9rem", opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? "Please wait…" : tab === "signin" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "var(--navy)",
  color: "var(--text-primary)",
  fontSize: "0.875rem",
  outline: "none",
  boxSizing: "border-box",
};

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.5-1.45-.79-3-.79-4.59s.29-3.14.79-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 300 300" fill="currentColor">
      <path d="M178.57 127.15 290.27 0h-26.46l-97.03 110.38L89.34 0H0l117.13 166.93L0 300.25h26.46l102.4-116.59 81.8 116.59h89.34M36.01 19.54H76.66l187.13 262.13h-40.66"/>
    </svg>
  );
}
