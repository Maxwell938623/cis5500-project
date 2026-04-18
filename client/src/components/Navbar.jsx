import React, { useState } from "react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/trends", label: "Historical Trends" },
  { to: "/borough-equity", label: "Borough Equity" },
  { to: "/financial-impact", label: "Financial Impact" },
  { to: "/station-index", label: "Station Index" },
  { to: "/map", label: "Geo Map" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);

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
          <div style={{
            width: 32,
            height: 32,
            background: "var(--accent)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "white",
            flexShrink: 0,
          }}>
            M
          </div>
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--white)" }}>
            NYC Subway Analytics
          </span>
        </div>

        {/* Desktop links */}
        <div style={{ display: "flex", gap: 4 }} className="nav-links-desktop">
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
