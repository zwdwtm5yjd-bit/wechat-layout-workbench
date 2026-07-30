"use client";

export default function GlobalError({
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <html lang="zh-CN">
      <body>
        <main
          style={{
            alignItems: "center",
            background: "#f7f7f5",
            color: "#18181b",
            display: "flex",
            fontFamily: "system-ui, sans-serif",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "24px",
          }}
        >
          <section
            style={{
              background: "#ffffff",
              border: "1px solid #e4e4e7",
              borderRadius: "12px",
              maxWidth: "420px",
              padding: "32px",
              textAlign: "center",
            }}
          >
            <h1 style={{ fontSize: "20px", margin: "0 0 12px" }}>应用暂时无法打开</h1>
            <p style={{ color: "#71717a", lineHeight: 1.7, margin: 0 }}>
              请重新加载应用。如果问题持续出现，请稍后再试。
            </p>
            <button
              onClick={reset}
              style={{
                background: "#4f46e5",
                border: 0,
                borderRadius: "8px",
                color: "#ffffff",
                fontWeight: 600,
                marginTop: "20px",
                padding: "10px 16px",
              }}
              type="button"
            >
              重新加载
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
