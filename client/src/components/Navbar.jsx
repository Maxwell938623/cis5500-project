import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/trends", label: "Historical Trends" },
  { to: "/borough-equity", label: "Borough Equity" },
  { to: "/financial-impact", label: "Financial Impact" },
  { to: "/station-index", label: "Station Index" },
  { to: "/map", label: "Geo Map" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav style={{
      background: "var(--navy-light)",
      borderBottom: "1px solid var(--border)",
      position: "sticky",
      top: 0,
      zIndex: 1000,
    }}>
      <div style={{
        maxWidth: 1400,
        margin: "0 auto",
        padding: "0 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 60,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img
            src="/5500_logo.png"
            alt="NYC Subway Analytics logo"
            style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            objectFit: "cover",
            flexShrink: 0,
            display: "block",
          }}
          />
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--white)" }}>
            NYC Subway Analytics
          </span>
        </div>

        {/* Desktop links */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }} className="nav-links-desktop">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className="nav-link"
              style={({ isActive }) => ({
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: "0.875rem",
                fontWeight: 500,
                color: isActive ? "var(--white)" : "var(--text-secondary)",
                background: isActive ? "var(--accent-light)" : "transparent",
                border: isActive ? "1px solid var(--accent)" : "1px solid transparent",
                textDecoration: "none",
              })}
            >
              {item.label}
            </NavLink>
          ))}
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8, paddingLeft: 12, borderLeft: "1px solid var(--border)" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{user.name || user.email}</span>
              <button
                onClick={() => { logout(); navigate("/login", { replace: true }); }}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: "0.8rem",
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>

        {/* Hamburger for mobile */}
        <button
          onClick={() => setOpen(!open)}
          style={{
            display: "none",
            background: "none",
            border: "none",
            color: "var(--text-primary)",
            fontSize: "1.4rem",
            cursor: "pointer",
          }}
          className="nav-hamburger"
          aria-label="Toggle menu"
        >
          {open ? "✕" : "☰"}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div style={{
          background: "var(--navy-light)",
          borderTop: "1px solid var(--border)",
          padding: "8px 20px 12px",
        }}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              style={({ isActive }) => ({
                display: "block",
                padding: "10px 0",
                color: isActive ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: isActive ? 600 : 400,
                borderBottom: "1px solid var(--border)",
                textDecoration: "none",
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .nav-links-desktop { display: none !important; }
          .nav-hamburger { display: block !important; }
        }
      `}</style>
    </nav>
  );
}
