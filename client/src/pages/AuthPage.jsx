import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "../supabaseClient";

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.9 3.6 14.7 2.7 12 2.7 6.9 2.7 2.7 6.9 2.7 12S6.9 21.3 12 21.3c6.9 0 9.1-4.8 9.1-7.3 0-.5 0-.9-.1-1.2H12z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 .7a11.3 11.3 0 0 0-3.6 22c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.8 2.9 1.3 3.6 1 .1-.8.4-1.3.7-1.6-2.7-.3-5.6-1.4-5.6-6a4.7 4.7 0 0 1 1.2-3.2c-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.3 1.2a11.3 11.3 0 0 1 6 0c2.3-1.6 3.3-1.2 3.3-1.2.7 1.6.3 2.8.1 3.1a4.7 4.7 0 0 1 1.2 3.2c0 4.6-2.8 5.6-5.6 6 .4.3.8 1 .8 2v3c0 .3.2.7.8.6A11.3 11.3 0 0 0 12 .7z"
      />
    </svg>
  );
}

export default function AuthPage({ session }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  if (session) {
    return <Navigate to="/trends" replace />;
  }

  const resetMessages = () => {
    setMessage("");
    setError("");
  };

  const handleEmailAuth = async (event) => {
    event.preventDefault();
    resetMessages();
    setLoading(true);

    const action =
      mode === "signup"
        ? supabase.auth.signUp({ email, password })
        : supabase.auth.signInWithPassword({ email, password });

    const { error: authError } = await action;
    if (authError) {
      setError(authError.message);
    } else if (mode === "signup") {
      setMessage("Account created. Check your email to confirm if required.");
    }

    setLoading(false);
  };

  const handleOAuthLogin = async (provider) => {
    resetMessages();
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (authError) {
      setError(authError.message);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card ui-fade-in">
        <h1>NYC Subway Analytics</h1>
        <p className="auth-subtitle">Sign in to access the dashboard</p>

        {!isSupabaseConfigured ? (
          <div className="auth-alert auth-alert-error">
            Missing Supabase setup. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to `client/.env`.
          </div>
        ) : (
          <>
            <div className="auth-oauth-group">
              <button className="btn btn-primary auth-oauth-btn" onClick={() => handleOAuthLogin("google")}>
                <span className="auth-oauth-icon"><GoogleIcon /></span>
                Continue with Google
              </button>
              <button className="btn btn-ghost auth-oauth-btn" onClick={() => handleOAuthLogin("github")}>
                <span className="auth-oauth-icon"><GitHubIcon /></span>
                Continue with GitHub
              </button>
            </div>

            <div className="auth-divider">or</div>

            <form onSubmit={handleEmailAuth} className="auth-form">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />

              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 6 characters"
              />

              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"}
              </button>
            </form>

            {message && <div className="auth-alert auth-alert-success">{message}</div>}
            {error && <div className="auth-alert auth-alert-error">{error}</div>}

            <p className="auth-switch">
              {mode === "signup" ? "Already have an account?" : "Need an account?"}{" "}
              <button
                type="button"
                className="auth-switch-btn"
                onClick={() => {
                  resetMessages();
                  setMode(mode === "signup" ? "login" : "signup");
                }}
              >
                {mode === "signup" ? "Sign in" : "Create one"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
