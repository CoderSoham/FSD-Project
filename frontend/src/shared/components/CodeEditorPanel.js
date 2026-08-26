import React, { useRef, useState, useEffect } from "react";
import MonacoEditor, { loader } from "@monaco-editor/react";
import * as monacoEditor from "monaco-editor/esm/vs/editor/editor.api";

import DiffViewer from "react-diff-viewer";
import { saveCodeVersion, getCodeHistory, getCodeVersion, createBranch, getBranches, mergeBranches, addCodeComment, getCodeComments, deleteCodeComment } from '../../api';
import { connectCollabSession } from '../utils/collabSession';
import { MonacoBinding } from 'y-monaco';
import { Rnd } from 'react-rnd';
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

const panelStyle = {
  position: "fixed",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 2000,
  width: "70vw",
  height: "70vh",
  background: "var(--color-surface)",
  borderRadius: "16px",
  boxShadow: "0 8px 32px var(--color-shadow)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  border: "2px solid var(--color-primary)",
};

const headerStyle = {
  padding: "0 0 0 24px",
  background: "var(--color-surface-alt)",
  borderBottom: "1px solid var(--color-border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  fontWeight: 700,
  fontSize: "1.15rem",
  height: 56,
  position: "relative"
};

const closeBtnStyle = {
  position: "absolute",
  right: 0,
  top: 0,
  width: 56,
  height: 56,
  background: "none",
  border: "none",
  color: "var(--color-error)",
  fontSize: "2.2rem",
  cursor: "pointer",
  fontWeight: 900,
  lineHeight: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "color 0.2s, background 0.2s",
  zIndex: 10
};

const controlsStyle = {
  display: "flex",
  alignItems: "center",
  gap: 12,
};

const historyPanelStyle = {
  width: 320,
  background: "var(--color-surface-alt)",
  borderRight: "1px solid var(--color-border)",
  overflowY: "auto",
  padding: "10px 0 0 0",
  height: "100%",
  display: "flex",
  flexDirection: "column"
};

const versionItemStyle = (active) => ({
  padding: "10px 16px",
  borderBottom: "1px solid var(--color-border)",
  background: active ? "var(--color-primary)" : "inherit",
  color: active ? "#fff" : "var(--color-text)",
  cursor: "pointer",
  fontWeight: 500,
  fontSize: "0.98rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start"
});

const diffPanelStyle = {
  background: "var(--color-surface)",
  flex: 1,
  overflow: "auto",
  padding: 0,
  display: "flex",
  flexDirection: "column"
};

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

  useEffect(() => {
    if (showHistory && filename) {
      fetchHistory();
    }
    // eslint-disable-next-line
  }, [showHistory, filename, currentBranch]);

  useEffect(() => {
    if (filename) fetchBranchesList();
    // eslint-disable-next-line
  }, [filename]);

  useEffect(() => {
    fetchComments();
  }, [filename, currentBranch, history]);

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

  return (
    <Rnd
      size={panelSize}
      position={panelPos}
      minWidth={minPanelWidth}
      minHeight={minPanelHeight}
      maxWidth={maxPanelWidth}
      maxHeight={maxPanelHeight}
      bounds="window"
      dragHandleClassName="code-editor-header"
      onDragStop={(e, d) => {
        // Snap to edge if close
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
      style={{ zIndex: 2000 }}
    >
      <div style={{ ...panelStyle, width: '100%', height: '100%', position: 'relative' }}>
        <div className={"code-editor-header"} style={headerStyle}>
          <span style={{ letterSpacing: 1, color: "var(--color-primary)", fontWeight: 800, fontSize: 22, display: 'flex', alignItems: 'center' }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ marginRight: 8 }}><path d="M4 4h16v16H4z" fill="#5865f2"/><path d="M7 7h10v2H7zm0 4h10v2H7zm0 4h7v2H7z" fill="#fff"/></svg>
            Code Editor
          </span>
          <button
            style={closeBtnStyle}
            onClick={onClose}
            aria-label="Close code editor"
            title="Close code editor"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
          >
            ×
          </button>
          <div style={controlsStyle}>
            <input
              value={filename}
              onChange={e => setFilename(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontWeight: 500,
                fontSize: "1rem",
                outline: "none",
                width: 140,
                marginRight: 8
              }}
              placeholder="Filename"
            />
            <select
              value={language}
              onChange={e => setLanguage && setLanguage(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontWeight: 500,
                fontSize: "1rem",
                outline: "none"
              }}
            >
              {LANGUAGES.map(lang => (
                <option key={lang.value} value={lang.value}>{lang.label}</option>
              ))}
            </select>
            <button
              className="modern-btn"
              style={{ padding: "6px 14px" }}
              onClick={handleDownload}
              title="Download code as file"
            >
              ⬇ Download
            </button>
            <button
              className="modern-btn"
              style={{ padding: "6px 14px" }}
              onClick={() => fileInputRef.current.click()}
              title="Upload code file"
            >
              ⬆ Upload
            </button>
            <input
              type="file"
              accept={LANGUAGES.map(l => "." + l.ext).join(",")}
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <button
              className="modern-btn"
              style={{ padding: "6px 14px", background: "var(--color-success)" }}
              onClick={handleSaveVersion}
              disabled={saving}
              title="Save code version"
            >
              💾 Save Version
            </button>
            <button
              className="modern-btn"
              style={{ padding: "6px 14px", background: showHistory ? "var(--color-accent)" : undefined }}
              onClick={() => setShowHistory(h => !h)}
              title="Show version history"
            >
              🕑 History
            </button>
            <select
              value={currentBranch}
              onChange={e => setCurrentBranch(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontWeight: 500,
                fontSize: "1rem",
                outline: "none",
                marginRight: 8
              }}
              title="Switch branch"
            >
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <input
              value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              placeholder="New branch"
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontWeight: 500,
                fontSize: "1rem",
                outline: "none",
                width: 110,
                marginRight: 8
              }}
            />
            <button
              className="modern-btn"
              style={{ padding: "6px 14px", background: "var(--color-success)" }}
              onClick={handleCreateBranch}
              disabled={!newBranchName.trim() || history.length === 0}
              title="Create branch from current version"
            >
              ➕ Branch
            </button>
            <select
              value={mergeSource}
              onChange={e => setMergeSource(e.target.value)}
              style={{
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                color: "var(--color-text)",
                fontWeight: 500,
                fontSize: "1rem",
                outline: "none",
                marginRight: 8
              }}
              title="Select branch to merge into current"
            >
              <option value="">Merge branch...</option>
              {branches.filter(b => b !== currentBranch).map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <button
              className="modern-btn"
              style={{ padding: "6px 14px", background: "var(--color-accent)" }}
              onClick={handleMerge}
              disabled={!mergeSource || mergeSource === currentBranch}
              title="Merge selected branch into current"
            >
               Merge
            </button>
          </div>
        </div>
        <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
          {showHistory && (
            <div style={historyPanelStyle}>
              <div style={{ fontWeight: 700, fontSize: 16, padding: "8px 16px", borderBottom: "1px solid var(--color-border)" }}>
                Version History
              </div>
              {loadingHistory ? <div style={{ padding: 16 }}>Loading...</div> :
                history.length === 0 ? <div style={{ padding: 16, color: 'var(--color-secondary)' }}>No versions yet.</div> :
                  history.map((v, idx) => (
                    <div key={v._id} style={versionItemStyle(idx === 0)}>
                      <div style={{ fontWeight: 600 }}>{v.username} <span style={{ color: 'var(--color-secondary)', fontWeight: 400, fontSize: 13 }}>({new Date(v.timestamp).toLocaleString()})</span></div>
                      <div style={{ fontSize: 13, color: 'var(--color-secondary)', marginBottom: 4 }}>{v.language} • {v.filename}</div>
                      {idx > 0 && (
                        <button
                          className="modern-btn"
                          style={{ padding: '2px 10px', fontSize: 13, background: 'var(--color-primary)', marginTop: 2 }}
                          onClick={() => handleShowDiff(v._id, history[idx - 1]._id)}
                        >
                          View Diff
                        </button>
                      )}
                    </div>
                  ))}
            </div>
          )}
          <div style={diffPanelStyle}>
            {diffView ? (
              <div style={{ height: '100%', overflow: 'auto', background: 'var(--color-surface)' }}>
                <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>Diff: {diffView.oldMeta?.filename} ({diffView.oldMeta?.username}) → {diffView.newMeta?.filename} ({diffView.newMeta?.username})</span>
                  <button className="modern-btn" style={{ padding: '2px 10px', fontSize: 13 }} onClick={handleCloseDiff}>Close Diff</button>
                </div>
                <DiffViewer
                  oldValue={diffView.old}
                  newValue={diffView.new}
                  splitView={true}
                  showDiffOnly={false}
                  hideLineNumbers={false}
                  leftTitle={`Old (${new Date(diffView.oldMeta.timestamp).toLocaleString()})`}
                  rightTitle={`New (${new Date(diffView.newMeta.timestamp).toLocaleString()})`}
                  styles={{
                    variables: {
                      light: {
                        diffViewerBackground: 'var(--color-surface)',
                        addedBackground: '#e6ffed',
                        removedBackground: '#ffeef0',
                        wordAddedBackground: '#acf2bd',
                        wordRemovedBackground: '#fdb8c0',
                      },
                      dark: {
                        diffViewerBackground: 'var(--color-surface)',
                        addedBackground: '#144620',
                        removedBackground: '#632929',
                        wordAddedBackground: '#1b7a3a',
                        wordRemovedBackground: '#a33a3a',
                      }
                    }
                  }}
                />
              </div>
            ) : (
              <>
              {mergeResult?.hasConflicts && (
                <div style={{
                  background: '#4a1f1f', color: '#ffd7d7', padding: '8px 12px',
                  fontSize: 13, borderBottom: '1px solid #7a2f2f',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <span>
                    <strong>{mergeResult.conflictCount}</strong>{' '}
                    unresolved conflict{mergeResult.conflictCount === 1 ? '' : 's'} from
                    merging <strong>{mergeSource}</strong>. Search for{' '}
                    <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code> and resolve each block before saving.
                  </span>
                  <button
                    onClick={() => setMergeResult(null)}
                    style={{ background: 'transparent', color: '#ffd7d7',
                             border: '1px solid #7a2f2f', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Dismiss
                  </button>
                </div>
              )}
              <MonacoEditor
                height="100%"
                language={language}
                value={value}
                theme={document.documentElement.getAttribute("data-theme") === "dark" ? "vs-dark" : "light"}
                onChange={onChange}
                onMount={handleEditorMount}
                options={{
                  fontSize: 16,
                  minimap: { enabled: false },
                  smoothScrolling: true,
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  automaticLayout: true,
                  fontFamily: 'Fira Mono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  lineNumbers: "on",
                  roundedSelection: true,
                  cursorSmoothCaretAnimation: true,
                  cursorBlinking: "phase",
                  renderLineHighlight: "all",
                  scrollbar: {
                    verticalScrollbarSize: 8,
                    horizontalScrollbarSize: 8,
                  },
                }}
              />
              </>
            )}
          </div>
        </div>
        {/* Branch history and compare UI */}
        <div style={{ display: 'flex', gap: 24, margin: '16px 0' }}>
          <div>
            <label style={{ fontWeight: 600 }}>Branch history:</label>
            <select
              value={currentBranch}
              onChange={e => setCurrentBranch(e.target.value)}
              style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 4 }}
            >
              {branches.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <button
              style={{ marginLeft: 8, padding: '4px 10px', borderRadius: 4, background: 'var(--color-bg-alt)' }}
              onClick={() => setShowHistory(h => !h)}
            >
              {showHistory ? 'Hide' : 'Show'} History
            </button>
          </div>
          <div>
            <label style={{ fontWeight: 600 }}>Compare with branch:</label>
            <select
              value={compareBranch}
              onChange={e => setCompareBranch(e.target.value)}
              style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 4 }}
            >
              <option value="">Select branch...</option>
              {branches.filter(b => b !== currentBranch).map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
            <button
              style={{ marginLeft: 8, padding: '4px 10px', borderRadius: 4, background: 'var(--color-accent)' }}
              onClick={handleCompareBranches}
              disabled={!compareBranch || compareBranch === currentBranch}
            >
              Compare
            </button>
          </div>
        </div>
        {/* Show branch diff if set */}
        {compareDiff && (
          <div style={{ margin: '16px 0', border: '1px solid var(--color-border)', borderRadius: 8, background: 'var(--color-bg-alt)' }}>
            <div style={{ padding: 8, fontWeight: 600 }}>
              Diff: <span style={{ color: 'var(--color-accent)' }}>{compareDiff.oldBranch}</span> → <span style={{ color: 'var(--color-success)' }}>{compareDiff.newBranch}</span>
              <button style={{ float: 'right', background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }} onClick={() => setCompareDiff(null)}>×</button>
            </div>
            <DiffViewer
              oldValue={compareDiff.oldContent}
              newValue={compareDiff.newContent}
              splitView={true}
              leftTitle={compareDiff.oldBranch}
              rightTitle={compareDiff.newBranch}
              styles={{ variables: { light: { diffViewerBackground: '#f7f7f7' }, dark: { diffViewerBackground: '#23272f' } } }}
            />
          </div>
        )}
        {/* Inline comment input box */}
        {showCommentBox && commentPos && (
          <div style={{ position: 'absolute', top: 60, right: 40, zIndex: 10, background: '#fff', border: '1px solid #ccc', borderRadius: 8, padding: 16, boxShadow: '0 2px 8px #0002' }}>
            <div style={{ marginBottom: 8 }}>Add comment for lines {commentPos.startLine}-{commentPos.endLine || commentPos.startLine}:</div>
            <textarea value={commentInput} onChange={e => setCommentInput(e.target.value)} rows={3} style={{ width: 220, marginBottom: 8 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="modern-btn" onClick={handleAddComment}>Add</button>
              <button className="modern-btn" onClick={() => setShowCommentBox(false)}>Cancel</button>
            </div>
          </div>
        )}
        {/* List comments for current version */}
        {comments.length > 0 && (
          <div style={{ position: 'absolute', top: 60, left: 40, zIndex: 10, background: '#fff', border: '1px solid #ccc', borderRadius: 8, padding: 12, maxHeight: 300, overflowY: 'auto', minWidth: 260 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Inline Comments</div>
            {comments.map(c => (
              <div key={c._id} style={{ marginBottom: 8, fontSize: 14 }}>
                <span style={{ fontWeight: 500 }}>{c.username}</span> <span style={{ color: '#888', fontSize: 12 }}>({new Date(c.timestamp).toLocaleString()})</span>
                <div style={{ margin: '2px 0 2px 0' }}>{c.text}</div>
                <div style={{ color: '#555', fontSize: 12 }}>Lines {c.position.startLine}-{c.position.endLine || c.position.startLine}</div>
                {c.userId === (user?._id || "anonymous") && (
                  <button className="modern-btn" style={{ fontSize: 12, color: 'var(--color-error)' }} onClick={() => handleDeleteComment(c._id)}>Delete</button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Rnd>
  );
};

export default CodeEditorPanel; 