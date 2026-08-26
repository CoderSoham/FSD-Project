import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicVersion } from "../api";
import { markdownToHtml } from "../shared/utils/prose";

/**
 * The read-only page a citation points at.
 *
 * Deliberately reachable without an account: a reference in a paper is no use
 * if the reader needs credentials to follow it. It renders only versions an
 * author explicitly published, and shows the content hash so a reader can
 * verify the text is the one that was cited.
 */
const CitedVersionPage = () => {
  const { versionId } = useParams();
  const [state, setState] = useState({ loading: true });
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let live = true;
    getPublicVersion(versionId).then((res) => {
      if (live) setState({ loading: false, ...(res?.error ? { error: res.error } : { version: res }) });
    });
    return () => { live = false; };
  }, [versionId]);

  const copy = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("failed");
    }
  };

  if (state.loading) return <Shell><p style={muted}>Loading…</p></Shell>;

  if (state.error || !state.version) {
    return (
      <Shell>
        <h1 style={{ marginTop: 0 }}>Not available</h1>
        <p style={muted}>
          This version does not exist, or its author has not published it for citation.
        </p>
      </Shell>
    );
  }

  const v = state.version;
  const c = v.citation || {};
  const isProse = v.docType === "prose";

  return (
    <Shell>
      <header style={{ borderBottom: "1px solid #2f3136", paddingBottom: 16, marginBottom: 24 }}>
        <div style={{ ...muted, fontSize: 13, marginBottom: 4 }}>Cited version</div>
        <h1 style={{ margin: "0 0 8px" }}>{v.filename}</h1>
        <div style={muted}>
          {v.username} · branch <code style={code}>{v.branch}</code> ·{" "}
          {new Date(v.timestamp).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}
        </div>
        <div style={{ ...muted, fontSize: 12, marginTop: 8 }} title={v.contentHash}>
          sha256 <code style={code}>{c.shortHash || (v.contentHash || "").slice(0, 12)}</code>
          {" — recompute this over the text below to confirm it is what was cited."}
        </div>
      </header>

      <section style={{ marginBottom: 28 }}>
        {isProse ? (
          <div
            className="prose-readonly"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(v.content) }}
          />
        ) : (
          <pre style={pre}><code>{v.content}</code></pre>
        )}
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Cite this version</h2>
        {[["Reference", c.text], ["BibTeX", c.bibtex]].map(([label, value]) =>
          value ? (
            <div key={label} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <span style={{ ...muted, fontSize: 13 }}>{label}</span>
                <button onClick={() => copy(value, label)} style={btn}>
                  {copied === label ? "Copied" : "Copy"}
                </button>
              </div>
              <pre style={{ ...pre, fontSize: 13 }}>{value}</pre>
            </div>
          ) : null
        )}
      </section>
    </Shell>
  );
};

const Shell = ({ children }) => (
  <div style={{ minHeight: "100vh", background: "#36393f", color: "#dcddde", padding: "48px 20px" }}>
    <div style={{ maxWidth: 780, margin: "0 auto", fontFamily: "Inter, system-ui, sans-serif", lineHeight: 1.6 }}>
      {children}
    </div>
  </div>
);

const muted = { color: "#a3a6aa" };
const code = { background: "#2f3136", padding: "1px 5px", borderRadius: 3 };
const pre = {
  background: "#2b2d31", padding: 14, borderRadius: 6, overflowX: "auto",
  whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0,
};
const btn = {
  background: "transparent", color: "#dcddde", border: "1px solid #4f545c",
  borderRadius: 4, padding: "2px 10px", cursor: "pointer", fontSize: 12,
};

export default CitedVersionPage;
