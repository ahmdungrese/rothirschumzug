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
    // Internal logging only, never leaked into the rendered HTML
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

  const rawMsg = (error?.message || "").toLowerCase();
  const isPermissionError = rawMsg.includes("permission") || rawMsg.includes("berechtigung") || rawMsg.includes("forbidden") || rawMsg.includes("unauthorized");

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
          maxWidth: "460px",
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
            backgroundColor: isPermissionError ? "rgba(244, 63, 94, 0.15)" : "rgba(234, 179, 8, 0.15)",
            border: isPermissionError ? "1px solid rgba(244, 63, 94, 0.3)" : "1px solid rgba(234, 179, 8, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isPermissionError ? "#f43f5e" : "#eab308",
            fontSize: "26px"
          }}>
            {isPermissionError ? "🔒" : "⚠️"}
          </div>

          <h1 style={{
            fontSize: "19px",
            fontWeight: "bold",
            margin: "0 0 10px 0",
            color: "#ffffff"
          }}>
            {isPermissionError ? "Zugriff eingeschränkt / صلاحية مقيدة" : "Systemhinweis / تنبيه بالنظام"}
          </h1>

          <p style={{
            fontSize: "13px",
            color: "#94a3b8",
            lineHeight: 1.6,
            margin: "0 0 24px 0"
          }}>
            {isPermissionError ? (
              <>
                Sie haben keine Berechtigung für diese Ansicht. Bitte wenden Sie sich an die Administration.
                <br />
                ليس لديك الصلاحية الكافية للوصول لهذا القسم.
              </>
            ) : (
              <>
                Ein unerwarteter technischer Fehler ist aufgetreten. Ihre gespeicherten Daten in der Datenbank sind vollständig gesichert.
                <br />
                حدث خطأ أثناء تحميل الصفحة. بياناتك في قاعدة البيانات محفوظة بأمان تام.
              </>
            )}
          </p>

          <div style={{
            display: "flex",
            gap: "12px",
            justifyContent: "center",
            flexWrap: "wrap"
          }}>
            {!isPermissionError && (
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
                Erneut versuchen
              </button>
            )}
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
              Zum Dashboard / العودة للرئيسية
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
