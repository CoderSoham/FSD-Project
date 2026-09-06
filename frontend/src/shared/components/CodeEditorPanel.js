import React, { useRef, useState, useEffect } from "react";
import MonacoEditor, { loader } from "@monaco-editor/react";
import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";

import DiffViewer from "react-diff-viewer";
import { saveCodeVersion, getCodeHistory, getCodeVersion, createBranch, getBranches, mergeBranches, addCodeComment, getCodeComments, deleteCodeComment } from '../../api';
import { connectCollabSession } from '../utils/collabSession';
import { MonacoBinding } from 'y-monaco';
import { Rnd } from 'react-rnd';
import './CodeEditorPanel.css';
import { notifySuccess, notifyError, notifyWarning } from '../utils/notification';

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

const CodeEditorPanel = ({ open, onClose, language, setLanguage, value, onChange, sessionId }) => {
  const fileInputRef = useRef();
  const [filename, setFilename] = useState("code.js");
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [diffView, setDiffView] = useState(null); // { oldVersion, newVersion }
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [branches, setBranches] = useState(["main"]);
  const [currentBranch, setCurrentBranch] = useState("main");
  const [newBranchName, setNewBranchName] = useState("");
  const [mergeSource, setMergeSource] = useState("");
  const [compareBranch, setCompareBranch] = useState("");
  const [compareDiff, setCompareDiff] = useState(null); // { oldContent, newContent, oldBranch, newBranch }
  const user = JSON.parse(localStorage.getItem("user") || '{}');
  const [comments, setComments] = useState([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentPos, setCommentPos] = useState(null); // {startLine, startColumn, endLine, endColumn}
  const [showCommentBox, setShowCommentBox] = useState(false);
  const editorRef = useRef();
  const [editorReady, setEditorReady] = useState(false);
  const [mergeResult, setMergeResult] = useState(null);
  const [panelSize, setPanelSize] = useState({ width: 0.7 * window.innerWidth, height: 0.7 * window.innerHeight });
  const [panelPos, setPanelPos] = useState({ x: window.innerWidth * 0.15, y: window.innerHeight * 0.15 });

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
  // onChange plumbing here at all -- the CRDT owns the document text and the
  // binding applies remote edits directly to the model.
  useEffect(() => {
    if (!sessionId || !open || !editorReady || !editorRef.current) return;
    const session = connectCollabSession({ sessionId, user });
    if (!session) return;

    // The transport is shared with the prose editor; only the binding differs.
    const binding = new MonacoBinding(
      session.doc.getText('code'),
      editorRef.current.getModel(),
      new Set([editorRef.current]),
      session.awareness
    );

    return () => {
      binding.destroy();
      session.destroy();
    };
  }, [sessionId, open, editorReady, user]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const res = await getCodeHistory(filename);
    if (!res.error) setHistory(res.filter(v => v.branch === currentBranch));
    setLoadingHistory(false);
  };

  const fetchBranchesList = async () => {
    const res = await getBranches(filename);
    if (!res.error && Array.isArray(res)) setBranches(res);
  };

  // Download code as file
  const handleDownload = () => {
    const lang = LANGUAGES.find(l => l.value === language) || LANGUAGES[0];
    const blob = new Blob([value || ""], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `code.${lang.ext}`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Upload code from file
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFilename(file.name);
    const ext = file.name.split('.').pop();
    const lang = LANGUAGES.find(l => l.ext === ext);
    if (lang && setLanguage) setLanguage(lang.value);
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (onChange) onChange(evt.target.result);
    };
    reader.readAsText(file);
  };

  // Save code version
  const handleSaveVersion = async () => {
    setSaving(true);
    const parentVersionId = history.length > 0 ? history[0]._id : null;
    const res = await saveCodeVersion({
      filename,
      language,
      content: value,
      userId: user?._id || "anonymous",
      username: user?.username || "anonymous",
      parentVersionId,
      branch: currentBranch
    });
    if (!res.error) {
      setShowHistory(true);
      fetchHistory();
    }
    setSaving(false);
  };

  // Create new branch
  const handleCreateBranch = async () => {
    if (!newBranchName.trim() || history.length === 0) return;
    const res = await createBranch({
      filename,
      branch: newBranchName.trim(),
      fromVersionId: history[0]._id
    });
    if (!res.error) {
      setCurrentBranch(newBranchName.trim());
      setNewBranchName("");
      fetchBranchesList();
      fetchHistory();
    }
  };

  // Merge branches.
  // The server performs a real three-way merge against the version the two
  // branches diverged from, so conflicts are possible and must be surfaced --
  // silently accepting a merge that contains conflict markers would leave the
  // document broken with no indication why.
  const handleMerge = async () => {
    if (!mergeSource || mergeSource === currentBranch) return;
    // identity comes from the auth token server-side; sending it is pointless
    const res = await mergeBranches({
      filename,
      sourceBranch: mergeSource,
      targetBranch: currentBranch,
    });
    if (res.error) {
      notifyError(res.error);
      return;
    }
    fetchHistory();
    if (res.unrelatedHistories) {
      notifyWarning("These branches share no history — every line was treated as new.");
    }
    if (res.hasConflicts) {
      setMergeResult(res);
      notifyWarning(
        `Merged with ${res.conflictCount} conflict${res.conflictCount === 1 ? "" : "s"}. ` +
        `Resolve the marked sections before saving.`
      );
    } else {
      notifySuccess(`Merged ${mergeSource} into ${currentBranch}.`);
    }
  };

  // Show diff between two versions
  const handleShowDiff = async (oldVersionId, newVersionId) => {
    const oldV = await getCodeVersion(oldVersionId);
    const newV = await getCodeVersion(newVersionId);
    setDiffView({ old: oldV.content, new: newV.content, oldMeta: oldV, newMeta: newV });
  };

  // Close diff view
  const handleCloseDiff = () => setDiffView(null);

  // Fetch history for a specific branch
  const fetchBranchHistory = async (branch) => {
    const res = await getCodeHistory(filename);
    if (!res.error) return res.filter(v => v.branch === branch);
    return [];
  };

  // Compare latest versions of two branches
  const handleCompareBranches = async () => {
    if (!compareBranch || compareBranch === currentBranch) return;
    const [mainHistory, otherHistory] = await Promise.all([
      fetchBranchHistory(currentBranch),
      fetchBranchHistory(compareBranch)
    ]);
    if (mainHistory.length && otherHistory.length) {
      setCompareDiff({
        oldContent: otherHistory[0].content,
        newContent: mainHistory[0].content,
        oldBranch: compareBranch,
        newBranch: currentBranch
      });
    }
  };

  // Fetch comments for current file/branch/version
  const fetchComments = async () => {
    const params = { filename, branch: currentBranch };
    if (history.length > 0) params.codeVersionId = history[0]._id;
    const res = await getCodeComments(params);
    if (!res.error) setComments(res);
  };

  // Add comment
  const handleAddComment = async () => {
    if (!commentInput.trim() || !commentPos) return;
    const res = await addCodeComment({
      codeVersionId: history[0]?._id,
      filename,
      branch: currentBranch,
      userId: user?._id || "anonymous",
      username: user?.username || "anonymous",
      text: commentInput.trim(),
      position: commentPos
    });
    if (!res.error) {
      setCommentInput("");
      setCommentPos(null);
      setShowCommentBox(false);
      fetchComments();
    }
  };

  // Delete comment
  const handleDeleteComment = async (id) => {
    await deleteCodeComment(id);
    fetchComments();
  };

  // Monaco: handle selection for comment
  const handleEditorMount = (editor, monaco) => {
    editorRef.current = editor;
    setEditorReady(true);
    editor.onMouseDown(e => {
      if (e.target.type === monaco.editor.MouseTargetType.CONTENT_TEXT) {
        const sel = editor.getSelection();
        if (sel && (sel.startLineNumber !== sel.endLineNumber || sel.startColumn !== sel.endColumn)) {
          setCommentPos({
            startLine: sel.startLineNumber,
            startColumn: sel.startColumn,
            endLine: sel.endLineNumber,
            endColumn: sel.endColumn
          });
          setShowCommentBox(true);
        }
      }
    });
  };

  // Monaco: decorate comments
  useEffect(() => {
    if (!editorRef.current || !comments.length) return;
    const editor = editorRef.current;
    const decorations = comments.map(c => ({
      range: new window.monaco.Range(
        c.position.startLine,
        c.position.startColumn,
        c.position.endLine || c.position.startLine,
        c.position.endColumn || c.position.startColumn
      ),
      options: {
        isWholeLine: false,
        inlineClassName: 'inline-comment-highlight',
        hoverMessage: { value: `**${c.username}**: ${c.text}` }
      }
    }));
    editor.deltaDecorations([], decorations);
  }, [comments]);

  if (!open) return null;
  const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";

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
        let x = d.x, y = d.y;
        if (x < snap) x = 0;
        if (y < snap) y = 0;
        if (x > window.innerWidth - panelSize.width - snap) x = window.innerWidth - panelSize.width;
        if (y > window.innerHeight - panelSize.height - snap) y = window.innerHeight - panelSize.height;
        setPanelPos({ x, y });
      }}
      onResizeStop={(e, direction, ref, delta, position) => {
        setPanelSize({ width: ref.offsetWidth, height: ref.offsetHeight });
        setPanelPos(position);
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
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>

          <span className="toolbar__sep" />

          <button className="btn btn--quiet btn--sm" onClick={handleDownload} title="Download as a file">
            Download
          </button>
          <button className="btn btn--quiet btn--sm" onClick={() => fileInputRef.current.click()} title="Upload a file">
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

        {/* Branch level controls, kept on their own row so the two kinds of
            action do not compete for attention. */}
        <div className="panel__toolbar code-panel__branches">
          <label className="subtle code-panel__label" htmlFor="cp-branch">Branch</label>
          <select
            id="cp-branch"
            className="field"
            value={currentBranch}
            onChange={(e) => setCurrentBranch(e.target.value)}
          >
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>

          <input
            className="field code-panel__newbranch"
            value={newBranchName}
            onChange={(e) => setNewBranchName(e.target.value)}
            placeholder="New branch name"
            aria-label="New branch name"
          />
          <button
            className="btn btn--quiet btn--sm"
            onClick={handleCreateBranch}
            disabled={!newBranchName.trim() || history.length === 0}
            title="Branch from the current version"
          >
            Create
          </button>

          <span className="toolbar__sep" />

          <select
            className="field"
            value={mergeSource}
            onChange={(e) => setMergeSource(e.target.value)}
            aria-label="Branch to merge in"
          >
            <option value="">Merge from</option>
            {branches.filter((b) => b !== currentBranch).map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <button
            className="btn btn--quiet btn--sm"
            onClick={handleMerge}
            disabled={!mergeSource || mergeSource === currentBranch}
          >
            Merge
          </button>

          <span className="toolbar__sep" />

          <select
            className="field"
            value={compareBranch}
            onChange={(e) => setCompareBranch(e.target.value)}
            aria-label="Branch to compare against"
          >
            <option value="">Compare with</option>
            {branches.filter((b) => b !== currentBranch).map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
          <button
            className="btn btn--quiet btn--sm"
            onClick={handleCompareBranches}
            disabled={!compareBranch || compareBranch === currentBranch}
          >
            Compare
          </button>
        </div>

        {mergeResult?.hasConflicts && (
          <div className="notice notice--danger">
            <span>
              <strong>{mergeResult.conflictCount}</strong> unresolved
              conflict{mergeResult.conflictCount === 1 ? "" : "s"} from merging{" "}
              <strong>{mergeSource}</strong>. Search for <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code> and
              resolve each block before saving.
            </span>
            <button className="btn btn--ghost btn--sm" onClick={() => setMergeResult(null)}>
              Dismiss
            </button>
          </div>
        )}

        <div className="code-panel__main">
          {showHistory && (
            <aside className="code-panel__history">
              <div className="code-panel__history-head">Version history</div>
              {loadingHistory ? (
                <div className="empty-state">Loading</div>
              ) : history.length === 0 ? (
                <div className="empty-state">No versions saved yet</div>
              ) : (
                history.map((v, idx) => (
                  <div
                    key={v._id}
                    className={`code-panel__version${idx === 0 ? " code-panel__version--current" : ""}`}
                  >
                    <div className="code-panel__version-top">
                      <span>{v.username}</span>
                      {idx === 0 && <span className="badge badge--accent">current</span>}
                    </div>
                    <div className="list-row__meta">
                      {new Date(v.timestamp).toLocaleString()}
                    </div>
                    {v.hasConflicts && (
                      <span className="badge badge--danger">
                        {v.conflictCount} conflict{v.conflictCount === 1 ? "" : "s"}
                      </span>
                    )}
                    {idx > 0 && (
                      <button
                        className="btn btn--quiet btn--sm"
                        onClick={() => handleShowDiff(v._id, history[idx - 1]._id)}
                      >
                        View diff
                      </button>
                    )}
                  </div>
                ))
              )}
            </aside>
          )}

          <div className="code-panel__editor">
            {diffView ? (
              <div className="code-panel__diff">
                <div className="code-panel__diff-head">
                  <span>
                    {diffView.oldMeta?.username} to {diffView.newMeta?.username}
                  </span>
                  <button className="btn btn--quiet btn--sm" onClick={handleCloseDiff}>Close</button>
                </div>
                <DiffViewer
                  oldValue={diffView.old}
                  newValue={diffView.new}
                  splitView
                  useDarkTheme={isDark()}
                  leftTitle={new Date(diffView.oldMeta.timestamp).toLocaleString()}
                  rightTitle={new Date(diffView.newMeta.timestamp).toLocaleString()}
                />
              </div>
            ) : compareDiff ? (
              <div className="code-panel__diff">
                <div className="code-panel__diff-head">
                  <span className="mono">{compareDiff.oldBranch} to {compareDiff.newBranch}</span>
                  <button className="btn btn--quiet btn--sm" onClick={() => setCompareDiff(null)}>Close</button>
                </div>
                <DiffViewer
                  oldValue={compareDiff.oldContent}
                  newValue={compareDiff.newContent}
                  splitView
                  useDarkTheme={isDark()}
                  leftTitle={compareDiff.oldBranch}
                  rightTitle={compareDiff.newBranch}
                />
              </div>
            ) : (
              <MonacoEditor
                height="100%"
                language={language}
                value={value}
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

          {comments.length > 0 && (
            <aside className="code-panel__comments">
              <div className="code-panel__history-head">Comments</div>
              {comments.map((c) => (
                <div className="code-panel__comment" key={c._id}>
                  <div className="code-panel__version-top">
                    <span>{c.username}</span>
                    <span className="list-row__meta">
                      L{c.position.startLine}
                      {c.position.endLine && c.position.endLine !== c.position.startLine
                        ? `-${c.position.endLine}` : ""}
                    </span>
                  </div>
                  <div>{c.text}</div>
                  <div className="list-row__meta">{new Date(c.timestamp).toLocaleString()}</div>
                  {c.userId === (user?._id || "anonymous") && (
                    <button className="btn btn--ghost btn--sm" onClick={() => handleDeleteComment(c._id)}>
                      Delete
                    </button>
                  )}
                </div>
              ))}
            </aside>
          )}
        </div>

        {showCommentBox && commentPos && (
          <div className="code-panel__comment-box">
            <div className="subtle">
              Comment on lines {commentPos.startLine}
              {commentPos.endLine && commentPos.endLine !== commentPos.startLine
                ? `-${commentPos.endLine}` : ""}
            </div>
            <textarea
              className="field code-panel__comment-input"
              value={commentInput}
              onChange={(e) => setCommentInput(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="code-panel__comment-actions">
              <button className="btn btn--quiet btn--sm" onClick={() => setShowCommentBox(false)}>
                Cancel
              </button>
              <button className="btn btn--primary btn--sm" onClick={handleAddComment}>
                Comment
              </button>
            </div>
          </div>
        )}
      </div>
    </Rnd>
  );
};

export default CodeEditorPanel;
