import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getPublicVersion } from "../api";
import { markdownToHtml } from "../shared/utils/prose";
import "./CitedVersionPage.css";

/**
 * The read only page a citation points at.
 *
 * Reachable without an account on purpose. A reference in a paper is no use if
 * following it lands the reader on a login screen.
 *
 * It renders only versions an author has explicitly published, and it shows the
 * content hash so a reader can confirm the text in front of them is the text
 * that was cited.
 */
const CitedVersionPage = () => {
  const { versionId } = useParams();
  const [state, setState] = useState({ loading: true });
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let live = true;
    getPublicVersion(versionId).then((res) => {
      if (!live) return;
      setState({ loading: false, ...(res?.error ? { error: res.error } : { version: res }) });
    });
    return () => { live = false; };
  }, [versionId]);

  const copy = async (text, which) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(""), 2000);
    } catch {
      setCopied("");
    }
  };

  if (state.loading) {
    return (
      <Shell>
        <div className="cited__skeleton" aria-busy="true" aria-label="Loading">
          <span /><span /><span />
        </div>
      </Shell>
    );
  }

  if (state.error || !state.version) {
    return (
      <Shell>
        <div className="empty-state">
          <h1 className="cited__gone-title">Not available</h1>
          <p>This version does not exist, or its author has not published it for citation.</p>
        </div>
      </Shell>
    );
  }

  const v = state.version;
  const c = v.citation || {};
  const shortHash = c.shortHash || (v.contentHash || "").slice(0, 12);

  return (
    <Shell>
      <header className="cited__header">
        <span className="badge badge--accent">Cited version</span>
        <h1 className="cited__title">{v.filename}</h1>
        <p className="cited__byline">
          {v.username}
          <span className="cited__dot" />
          <span className="mono">{v.branch}</span>
          <span className="cited__dot" />
          <time dateTime={v.timestamp}>
            {new Date(v.timestamp).toLocaleDateString(undefined, {
              year: "numeric", month: "long", day: "numeric",
            })}
          </time>
        </p>
        <p className="cited__hash" title={v.contentHash}>
          sha256 <code className="mono">{shortHash}</code>
          <span className="subtle"> recompute this over the text below to confirm it is what was cited</span>
        </p>
      </header>

      <article className="cited__content">
        {v.docType === "prose"
          ? <div className="prose-readonly" dangerouslySetInnerHTML={{ __html: markdownToHtml(v.content) }} />
          : <pre className="cited__code"><code>{v.content}</code></pre>}
      </article>

      <section className="cited__cite">
        <h2 className="cited__section-title">Cite this version</h2>
        {[["Reference", c.text], ["BibTeX", c.bibtex]].map(([label, value]) =>
          value ? (
            <div className="cited__ref" key={label}>
              <div className="cited__ref-head">
                <span className="subtle">{label}</span>
                <button className="btn btn--quiet btn--sm" onClick={() => copy(value, label)}>
                  {copied === label ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="cited__ref-body">{value}</pre>
            </div>
          ) : null
        )}
      </section>
    </Shell>
  );
};

const Shell = ({ children }) => (
  <div className="cited">
    <div className="cited__page">{children}</div>
  </div>
);

export default CitedVersionPage;
