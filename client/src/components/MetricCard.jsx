import React from "react";

export default function MetricCard({ label, value, subValue, color, icon }) {
  return (
    <div
      style={{
        background: "var(--card-bg)",
        border: `1px solid ${color ? color + "44" : "var(--border)"}`,
        borderRadius: 12,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontSize: "0.75rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--text-secondary)",
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        {icon && (
          <span style={{ fontSize: "1.2rem", opacity: 0.7 }}>{icon}</span>
        )}
      </div>
      <div
        style={{
          fontSize: "1.6rem",
          fontWeight: 700,
          color: color || "var(--white)",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {subValue && (
        <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>{subValue}</div>
      )}
    </div>
  );
}
