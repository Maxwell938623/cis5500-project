import React from "react";

export default function ErrorMessage({ message, onRetry }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 20px",
        gap: 12,
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: "2rem" }}>⚠</div>
      <div style={{ fontWeight: 600, color: "var(--white)" }}>Failed to load data</div>
      <div
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.875rem",
          maxWidth: 400,
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.2)",
          borderRadius: 8,
          padding: "10px 16px",
        }}
      >
        {message}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="btn btn-primary"
          style={{ marginTop: 4 }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
