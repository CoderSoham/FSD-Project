import React, { useRef, useState, useEffect, useMemo } from "react";
import MonacoEditor, { loader } from "@monaco-editor/react";
import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";

import {
  saveCodeVersion,
  getCodeHistory,
  getCodeVersion,
  createBranch,
  getBranches,
  mergeBranches,
  addCodeComment,
  getCodeComments,
  deleteCodeComment,
} from "../../api";
import { connectCollabSession } from "../utils/collabSession";
import { MonacoBinding } from "y-monaco";
import { Rnd } from "react-rnd";
import "./CodeEditorPanel.css";
import { notifySuccess, notifyError, notifyWarning } from "../utils/notification";
import VersionHistoryList from "./editor/VersionHistoryList";
import BranchControls from "./editor/BranchControls";
import ConflictBanner from "./editor/ConflictBanner";
import DiffPane from "./editor/DiffPane";
import { CommentList, CommentComposer } from "./editor/CommentLayer";

// Use the bundled Monaco rather than the CDN copy @monaco-editor/react loads by
// default. y-monaco imports monaco-editor directly, and two separate Monaco
// instances would mean the CRDT binding manipulating a different editor API
// than the one on screen. It also means the editor works offline.
loader.config({ monaco: monacoEditor });

const LANGUAGES = [
  { label: "JavaScript", value: "javascript", ext: "js" },
  { label: "Python", value: "python", ext: "py" },
  { label: "TypeScript", value: "typescript", ext: "ts" },
  { label: "C++", value: "cpp", ext: "cpp" },
  { label: "C#", value: "csharp", ext: "cs" },
  { label: "Java", value: "java", ext: "java" },
  { label: "HTML", value: "html", ext: "html" },
  { label: "CSS", value: "css", ext: "css" },
  { label: "JSON", value: "json", ext: "json" },
  { label: "Markdown", value: "markdown", ext: "md" },
];

const minPanelWidth = 480;
const minPanelHeight = 320;
const maxPanelWidth = window.innerWidth - 32;
const maxPanelHeight = window.innerHeight - 32;

const isDark = () =>
  document.documentElement.getAttribute("data-theme") === "dark";

/**
 * The code editor panel.
 *
 * What is left here is composition and the collaborative binding. Version
 * history, branch controls, comments, the conflict banner and the diff view all
 * live in ./editor and are shared with the prose editor where they apply. This
 * file was 807 lines and could not be tested as anything smaller than a browser.
 */
const CodeEditorPanel = ({ open, onClose, language, setLanguage, value, onChange, sessionId }) => {
  const fileInputRef = useRef();
  const [filename, setFilename] = useState("code.js");

  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [diffView, setDiffView] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState(["main"]);
  const [currentBranch, setCurrentBranch] = useState("main");
  const [compareDiff, setCompareDiff] = useState(null);
  const [mergeResult, setMergeResult] = useState(null);

  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentPos, setCommentPos] = useState(null);

  const editorRef = useRef();
  const [editorReady, setEditorReady] = useState(false);
  const [panelSize, setPanelSize] = useState({
    width: 0.7 * window.innerWidth,
    height: 0.7 * window.innerHeight,
  });
  const [panelPos, setPanelPos] = useState({
    x: window.innerWidth * 0.15,
    y: window.innerHeight * 0.15,
  });

  /**
   * Which shared document this editor is bound to.
   *
   * AppBar renders this panel without a sessionId, and the effect that opens
   * the collaborative session bailed out when it was undefined. So the CRDT was
   * wired up, tested and never actually connected to anything from the UI.
   *
   * Deriving it from the document and branch means two people who open the same
   * file are in the same session, which is the behaviour a reader would expect
   * and the only one that makes the feature useful.
   */
  const collabSessionId = sessionId || `doc:${filename}:${currentBranch}`;

  /**
   * The signed in user.
   *
   * Parsed once. This used to be parsed inline on every render, which produced
   * a new object identity each time. It sits in the dependency array of the
   * effect that opens the collaborative session, so every render tore the Yjs
   * session and the Monaco binding down and built them again. Since typing
   * causes a render, the binding was destroyed on every keystroke and the
   * document was wiped before a single character could be committed to it.
   */
  const user = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  }, []);

  // Every /api/code call requires a token. Firing them before the user has one
  // produced a pair of 403s in the console on the login and register screens,
  // and would surface as an error toast on a slow connection.
  const signedIn = Boolean(user?.token);

  useEffect(() => {
    if (signedIn && showHistory && filename) fetchHistory();
    // eslint-disable-next-line
  }, [signedIn, showHistory, filename, currentBranch]);

  useEffect(() => {
    if (signedIn && filename) fetchBranchesList();
    // eslint-disable-next-line
  }, [signedIn, filename]);

  useEffect(() => {
    if (signedIn && filename) fetchComments();
    // eslint-disable-next-line
  }, [signedIn, filename, currentBranch, history]);

  // Collaborative editing is bound to the Monaco model by Yjs, so there is no
  // onChange plumbing here at all. The CRDT owns the document text and the
  // binding applies remote edits directly to the model.
  useEffect(() => {
    if (!collabSessionId || !open || !editorReady || !editorRef.current) return;
    const session = connectCollabSession({ sessionId: collabSessionId, user });
    if (!session) return;

    // The transport is shared with the prose editor; only the binding differs.
    const binding = new MonacoBinding(
      session.doc.getText("code"),
      editorRef.current.getModel(),
      new Set([editorRef.current]),
      session.awareness
    );

    return () => {
      binding.destroy();
      session.destroy();
    };
  }, [collabSessionId, open, editorReady, user]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const res = await getCodeHistory(filename);
    if (!res.error) setHistory(res.filter((v) => v.branch === currentBranch));
    setLoadingHistory(false);
  };

  const fetchBranchesList = async () => {
    const res = await getBranches(filename);
    if (!res.error && Array.isArray(res)) setBranches(res);
  };

  const fetchComments = async () => {
    const params = { filename, branch: currentBranch };
    if (history.length > 0) params.codeVersionId = history[0]._id;
    const res = await getCodeComments(params);
    if (!res.error) setComments(res);
  };

  /**
   * The current text.
   *
   * Once a collaborative session is open, Yjs owns the buffer and the React
   * `value` prop is stale the moment anyone types. Reading the model is the
   * only answer that is true for both the shared and the solo case.
   */
  const readContent = () => {
    try {
      const fromEditor = editorRef.current?.getValue();
      if (typeof fromEditor === "string") return fromEditor;
    } catch (e) {
      /* editor not mounted yet */
    }
    return value || "";
  };

  const handleDownload = () => {
    const lang = LANGUAGES.find((l) => l.value === language) || LANGUAGES[0];
    const blob = new Blob([readContent()], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `code.${lang.ext}`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFilename(file.name);
    const ext = file.name.split(".").pop();
    const lang = LANGUAGES.find((l) => l.ext === ext);
    if (lang && setLanguage) setLanguage(lang.value);
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (onChange) onChange(evt.target.result);
    };
    reader.readAsText(file);
  };

  const handleSaveVersion = async () => {
    setSaving(true);
    const parentVersionId = history.length > 0 ? history[0]._id : null;
    const res = await saveCodeVersion({
      filename,
      language,
      content: readContent(),
      userId: user?._id || "anonymous",
      username: user?.username || "anonymous",
      parentVersionId,
      branch: currentBranch,
    });
    if (!res.error) {
      setShowHistory(true);
      fetchHistory();
    }
    setSaving(false);
  };

  const handleCreateBranch = async (name) => {
    if (history.length === 0) return;
    const res = await createBranch({
      filename,
      branch: name,
      fromVersionId: history[0]._id,
    });
    if (res.error) {
      notifyError(res.error);
      return;
    }
    setCurrentBranch(name);
    fetchBranchesList();
    fetchHistory();
  };

  // The server performs a real three-way merge against the version the two
  // branches diverged from, so conflicts are possible and must be surfaced.
  // Silently accepting a merge that contains conflict markers would leave the
  // document broken with no indication why.
  const handleMerge = async (sourceBranch) => {
    if (sourceBranch === currentBranch) return;
    // identity comes from the auth token server-side; sending it is pointless
    const res = await mergeBranches({
      filename,
      sourceBranch,
      targetBranch: currentBranch,
    });
    if (res.error) {
      notifyError(res.error);
      return;
    }
    fetchHistory();
    if (res.unrelatedHistories) {
      notifyWarning("These branches share no history, so every line was treated as new.");
    }
    if (res.hasConflicts) {
      setMergeResult({ ...res, sourceBranch });
      notifyWarning(
        `Merged with ${res.conflictCount} conflict${res.conflictCount === 1 ? "" : "s"}. ` +
          `Resolve the marked sections before saving.`
      );
    } else {
      notifySuccess(`Merged ${sourceBranch} into ${currentBranch}.`);
    }
  };

  const handleShowDiff = async (oldVersionId, newVersionId) => {
    const oldV = await getCodeVersion(oldVersionId);
    const newV = await getCodeVersion(newVersionId);
    setDiffView({ old: oldV.content, new: newV.content, oldMeta: oldV, newMeta: newV });
  };

  const fetchBranchHistory = async (branch) => {
    const res = await getCodeHistory(filename);
    if (!res.error) return res.filter((v) => v.branch === branch);
    return [];
  };

  const handleCompareBranches = async (other) => {
    if (other === currentBranch) return;
    const [mine, theirs] = await Promise.all([
      fetchBranchHistory(currentBranch),
      fetchBranchHistory(other),
    ]);
    if (!mine.length || !theirs.length) {
      notifyWarning(`Nothing saved on ${!theirs.length ? other : currentBranch} yet.`);
      return;
    }
    setCompareDiff({
      oldContent: theirs[0].content,
      newContent: mine[0].content,
      oldBranch: other,
      newBranch: currentBranch,
    });
  };

  const handleAddComment = async () => {
    if (!commentInput.trim() || !commentPos) return;
    const res = await addCodeComment({
      codeVersionId: history[0]?._id,
      filename,
      branch: currentBranch,
      userId: user?._id || "anonymous",
      username: user?.username || "anonymous",
      text: commentInput.trim(),
      position: commentPos,
    });
    if (!res.error) {
      setCommentInput("");
      setCommentPos(null);
      fetchComments();
    }
  };

  const handleDeleteComment = async (id) => {
    await deleteCodeComment(id);
    fetchComments();
  };

  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    setEditorReady(true);

    // Monaco measures its container when it mounts. Inside this panel it
    // sometimes measures before flex has resolved and settles at 5x5 pixels,
    // and automaticLayout's observer never fires afterwards because the
    // container itself never changes size. Two frames later the layout is
    // real, so ask it to measure again.
    const relayout = () => {
      try {
        editor.layout();
      } catch (e) {
        /* disposed */
      }
    };
    requestAnimationFrame(() => requestAnimationFrame(relayout));
    // rAF does not fire in a tab that is not compositing, so do not rely on it
    // alone.
    setTimeout(relayout, 60);
    setTimeout(relayout, 300);

    editor.onMouseDown((e) => {
      if (e.target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT) return;
      const sel = editor.getSelection();
      if (!sel) return;
      const isRange =
        sel.startLineNumber !== sel.endLineNumber || sel.startColumn !== sel.endColumn;
      if (!isRange) return;
      setCommentPos({
        startLine: sel.startLineNumber,
        startColumn: sel.startColumn,
        endLine: sel.endLineNumber,
        endColumn: sel.endColumn,
      });
    });
  };

  // Highlight the commented ranges in the editor.
  useEffect(() => {
    if (!editorRef.current || !comments.length) return;
    const editor = editorRef.current;
    const decorations = comments.map((c) => ({
      range: new window.monaco.Range(
        c.position.startLine,
        c.position.startColumn,
        c.position.endLine || c.position.startLine,
        c.position.endColumn || c.position.startColumn
      ),
      options: {
        isWholeLine: false,
        inlineClassName: "inline-comment-highlight",
        hoverMessage: { value: `**${c.username}**: ${c.text}` },
      },
    }));
    editor.deltaDecorations([], decorations);
  }, [comments]);

  if (!open) return null;

  return (
    <Rnd
      size={panelSize}
      position={panelPos}
      minWidth={minPanelWidth}
      minHeight={minPanelHeight}
      maxWidth={maxPanelWidth}
      maxHeight={maxPanelHeight}
      bounds="window"
      dragHandleClassName="panel__header"
      onDragStop={(e, d) => {
        // Snap to the edge when released near it.
        const snap = 32;
        let x = d.x;
        let y = d.y;
        if (x < snap) x = 0;
        if (y < snap) y = 0;
        if (x > window.innerWidth - panelSize.width - snap)
          x = window.innerWidth - panelSize.width;
        if (y > window.innerHeight - panelSize.height - snap)
          y = window.innerHeight - panelSize.height;
        setPanelPos({ x, y });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        setPanelSize({ width: ref.offsetWidth, height: ref.offsetHeight });
        setPanelPos(position);
        requestAnimationFrame(() => {
          try {
            editorRef.current?.layout();
          } catch (err) {
            /* disposed */
          }
        });
      }}
      style={{ zIndex: "var(--z-panel)" }}
    >
      <div className="panel code-panel">
        <header className="panel__header">
          <div className="panel__title">
            <span>Code</span>
            <span className="panel__title-meta mono">{currentBranch}</span>
          </div>
          <div className="code-panel__actions">
            <button
              className="btn btn--primary btn--sm"
              onClick={handleSaveVersion}
              disabled={saving}
              title="Save the current content as a new version"
            >
              {saving ? "Saving" : "Save version"}
            </button>
            <button
              className="btn btn--ghost btn--icon btn--sm"
              onClick={onClose}
              aria-label="Close code editor"
              title="Close"
            >
              &times;
            </button>
          </div>
        </header>

        {/* File level controls. */}
        <div className="panel__toolbar">
          <input
            className="field code-panel__filename"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
            placeholder="Filename"
            aria-label="Filename"
          />
          <select
            className="field"
            value={language}
            onChange={(e) => setLanguage && setLanguage(e.target.value)}
            aria-label="Language"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>

          <span className="toolbar__sep" />

          <button className="btn btn--quiet btn--sm" onClick={handleDownload} title="Download as a file">
            Download
          </button>
          <button
            className="btn btn--quiet btn--sm"
            onClick={() => fileInputRef.current.click()}
            title="Upload a file"
          >
            Upload
          </button>
          <input
            type="file"
            accept={LANGUAGES.map((l) => "." + l.ext).join(",")}
            ref={fileInputRef}
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          <span className="toolbar__sep" />

          <button
            className={`btn btn--sm ${showHistory ? "btn--on" : "btn--ghost"}`}
            onClick={() => setShowHistory((h) => !h)}
            aria-pressed={showHistory}
            title="Show version history"
          >
            History
          </button>
        </div>

        <BranchControls
          branches={branches}
          currentBranch={currentBranch}
          onSwitchBranch={setCurrentBranch}
          onCreateBranch={handleCreateBranch}
          onMerge={handleMerge}
          onCompare={handleCompareBranches}
          canBranch={history.length > 0}
        />

        <ConflictBanner
          count={mergeResult?.hasConflicts ? mergeResult.conflictCount : 0}
          sourceBranch={mergeResult?.sourceBranch}
          onDismiss={() => setMergeResult(null)}
        />

        <div className="code-panel__main">
          {showHistory && (
            <aside className="code-panel__history">
              <VersionHistoryList
                versions={history}
                loading={loadingHistory}
                renderActions={(v, idx) =>
                  idx > 0 && (
                    <button
                      className="btn btn--quiet btn--sm"
                      onClick={() => handleShowDiff(v._id, history[idx - 1]._id)}
                    >
                      View diff
                    </button>
                  )
                }
              />
            </aside>
          )}

          <div className="code-panel__editor">
            {diffView ? (
              <DiffPane
                label={`${diffView.oldMeta?.username} to ${diffView.newMeta?.username}`}
                oldValue={diffView.old}
                newValue={diffView.new}
                leftTitle={new Date(diffView.oldMeta.timestamp).toLocaleString()}
                rightTitle={new Date(diffView.newMeta.timestamp).toLocaleString()}
                onClose={() => setDiffView(null)}
              />
            ) : compareDiff ? (
              <DiffPane
                label={`${compareDiff.oldBranch} to ${compareDiff.newBranch}`}
                oldValue={compareDiff.oldContent}
                newValue={compareDiff.newContent}
                leftTitle={compareDiff.oldBranch}
                rightTitle={compareDiff.newBranch}
                onClose={() => setCompareDiff(null)}
              />
            ) : (
              <MonacoEditor
                height="100%"
                language={language}
                // Uncontrolled on purpose. Yjs writes directly to this model,
                // and a controlled `value` fights it: React resets the buffer
                // on every render and typed characters disappear.
                defaultValue={value}
                theme={isDark() ? "vs-dark" : "light"}
                onChange={onChange}
                onMount={handleEditorMount}
                options={{
                  fontSize: 14,
                  fontFamily: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                  minimap: { enabled: false },
                  smoothScrolling: true,
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                  lineNumbers: "on",
                  renderLineHighlight: "line",
                  padding: { top: 12, bottom: 12 },
                  scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
                }}
              />
            )}
          </div>

          <CommentList
            comments={comments}
            currentUserId={user?._id || "anonymous"}
            onDelete={handleDeleteComment}
          />
        </div>

        <CommentComposer
          position={commentPos}
          value={commentInput}
          onChange={setCommentInput}
          onSubmit={handleAddComment}
          onCancel={() => {
            setCommentPos(null);
            setCommentInput("");
          }}
        />
      </div>
    </Rnd>
  );
};

export default CodeEditorPanel;
