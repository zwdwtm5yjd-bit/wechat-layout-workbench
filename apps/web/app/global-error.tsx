"use client";

export default function GlobalError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  const reference = error.digest;

  return (
    <html lang="zh-CN">
      <body>
        <main
          style={{
            alignItems: "center",
            background: "var(--ui-canvas, #f7f7f5)",
            color: "var(--ui-text, #18181b)",
            display: "flex",
            fontFamily: "system-ui, sans-serif",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "24px",
          }}
        >
          <section
            style={{
              background: "var(--ui-panel, #ffffff)",
              border: "1px solid var(--ui-border, #e4e4e7)",
              borderRadius: "var(--ui-radius-card, 12px)",
              maxWidth: "420px",
              padding: "32px",
              textAlign: "center",
            }}
          >
            <h1 style={{ fontSize: "20px", margin: "0 0 12px" }}>应用暂时无法打开</h1>
            <p style={{ color: "var(--ui-text-secondary, #71717a)", lineHeight: 1.7, margin: 0 }}>
              请先重新尝试。如果仍然失败，可返回首页后重新进入。
            </p>
            {reference === undefined ? null : (
              <p
                style={{
                  color: "var(--ui-text-tertiary, #a1a1aa)",
                  fontSize: "11px",
                  margin: "12px 0 0",
                }}
              >
                问题编号：{reference}
              </p>
            )}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "12px",
                justifyContent: "center",
                marginTop: "20px",
              }}
            >
              <button
                className="transition-[background-color,transform] duration-150 hover:bg-accent-strong active:scale-[0.98]"
                onClick={reset}
                style={{
                  background: "var(--ui-accent, #4f46e5)",
                  border: 0,
                  borderRadius: "var(--ui-radius-control, 8px)",
                  color: "#ffffff",
                  fontWeight: 600,
                  minHeight: "40px",
                  padding: "8px 16px",
                }}
                type="button"
              >
                重新尝试
              </button>
              <a
                className="transition-[background-color,transform] duration-150 hover:bg-hover active:scale-[0.98]"
                href="/"
                style={{
                  alignItems: "center",
                  background: "var(--ui-panel, #ffffff)",
                  border: "1px solid var(--ui-border, #e4e4e7)",
                  borderRadius: "var(--ui-radius-control, 8px)",
                  color: "var(--ui-text, #18181b)",
                  display: "inline-flex",
                  fontWeight: 600,
                  minHeight: "40px",
                  padding: "8px 16px",
                  textDecoration: "none",
                }}
              >
                返回首页
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
