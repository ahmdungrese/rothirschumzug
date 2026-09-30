"use client";

import React, { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Critical Global Application Error:", error);
  }, [error]);

  const handleReset = () => {
    try {
      reset();
    } catch {
      if (typeof window !== "undefined") {
        window.location.href = "/dashboard";
      }
    }
  };

  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <html lang="de">
      <head>
        <title>Systemhinweis | Rothirsch Umzug</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        backgroundColor: "#0f172a",
        color: "#f8fafc",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        boxSizing: "border-box"
      }}>
        <div style={{
          maxWidth: "480px",
          width: "90%",
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "20px",
          padding: "32px",
          textAlign: "center",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
        }}>
          {/* Icon */}
          <div style={{
            width: "56px",
            height: "56px",
            margin: "0 auto 20px",
            borderRadius: "16px",
            backgroundColor: "rgba(239, 68, 68, 0.15)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ef4444",
            fontSize: "28px"
          }}>
            ⚠️
          </div>

          <h1 style={{
            fontSize: "20px",
            fontWeight: "bold",
            margin: "0 0 8px 0",
            color: "#ffffff"
          }}>
            System-Wiederherstellung / استعادة النظام
          </h1>

          <p style={{
            fontSize: "13px",
            color: "#94a3b8",
            lineHeight: 1.6,
            margin: "0 0 20px 0"
          }}>
            Ein unerwarteter technischer Fehler ist aufgetreten. Ihre gespeicherten Daten in der Datenbank sind vollständig gesichert.
            <br />
            حدث خطأ فني أثناء تحميل الصفحة. بياناتك في قاعدة البيانات محفوظة بأمان تام.
          </p>

          {error?.message && (
            <div style={{
              backgroundColor: "rgba(0, 0, 0, 0.3)",
              border: "1px solid #334155",
              borderRadius: "10px",
              padding: "10px 14px",
              marginBottom: "24px",
              textAlign: "left"
            }}>
              <span style={{
                fontSize: "10px",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#f87171",
                display: "block",
                marginBottom: "4px",
                fontWeight: "bold"
              }}>
                Fehler-Details / تفاصيل الخطأ:
              </span>
              <code style={{
                fontSize: "11px",
                color: "#fca5a5",
                fontFamily: "monospace",
                wordBreak: "break-word",
                display: "block"
              }}>
                {error.message}
              </code>
            </div>
          )}

          <div style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap"
          }}>
            <button
              onClick={handleReset}
              style={{
                flex: "1 1 140px",
                padding: "12px 18px",
                borderRadius: "12px",
                backgroundColor: "#8F1627",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: "bold",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 4px 12px rgba(143, 22, 39, 0.4)"
              }}
            >
              Erneut versuchen / إعادة المحاولة
            </button>
            <button
              onClick={handleReload}
              style={{
                flex: "1 1 140px",
                padding: "12px 18px",
                borderRadius: "12px",
                backgroundColor: "#334155",
                color: "#e2e8f0",
                fontSize: "13px",
                fontWeight: "bold",
                border: "1px solid #475569",
                cursor: "pointer"
              }}
            >
              Seite neu laden / تحديث الصفحة
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
