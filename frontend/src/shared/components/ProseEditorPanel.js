import React, { useEffect, useMemo, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { Rnd } from "react-rnd";
import { connectCollabSession } from "../utils/collabSession";
import { htmlToMarkdown, markdownToHtml, hasConflictMarkers } from "../utils/prose";
import { saveCodeVersion, getCodeHistory, getCodeVersion, setVersionCitable } from "../../api";
import { notifySuccess, notifyError, notifyWarning } from "../utils/notification";

/**
 * Collaborative prose editor for papers and notes.
 *
 * Monaco is a code editor. Researchers write prose -- headings, paragraphs,
 * citations, lists -- and asking them to draft a paper in a code editor is
 * asking them not to use the tool.
 *
 * This shares everything that was hard: the same Yjs transport as the code
 * editor (FEAT-001), the same version model, the same branching and three-way
 * merge (FEAT-002). Only the binding and the serialisation differ.
 */

const TOOLBAR = [
  { label: "B", title: "Bold", run: (e) => e.chain().focus().toggleBold().run(),
    active: (e) => e.isActive("bold") },
  { label: "I", title: "Italic", run: (e) => e.chain().focus().toggleItalic().run(),
    active: (e) => e.isActive("italic") },
  { label: "H1", title: "Heading 1", run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
    active: (e) => e.isActive("heading", { level: 1 }) },
  { label: "H2", title: "Heading 2", run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
    active: (e) => e.isActive("heading", { level: 2 }) },
  { label: "“ ”", title: "Quote", run: (e) => e.chain().focus().toggleBlockquote().run(),
    active: (e) => e.isActive("blockquote") },
  { label: "•", title: "Bullet list", run: (e) => e.chain().focus().toggleBulletList().run(),
    active: (e) => e.isActive("bulletList") },
  { label: "1.", title: "Numbered list", run: (e) => e.chain().focus().toggleOrderedList().run(),
    active: (e) => e.isActive("orderedList") },
  { label: "</>", title: "Code block", run: (e) => e.chain().focus().toggleCodeBlock().run(),
    active: (e) => e.isActive("codeBlock") },
];

const ProseEditorPanel = ({ open, onClose, filename, sessionId, user, branch = "main" }) => {
  const [session, setSession] = useState(null);
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);

  // One shared document, opened once per session.
  useEffect(() => {
    if (!open || !sessionId) return;
    const s = connectCollabSession({ sessionId, user });
    if (!s) {
      notifyError("Not connected — open a room first.");
      return;
    }
    setSession(s);
    return () => {
      s.destroy();
      setSession(null);
    };
  }, [open, sessionId, user]);

  const extensions = useMemo(() => {
    if (!session) return null;
    return [
      // history is disabled because Yjs owns undo/redo in a shared document;
      // ProseMirror's own history would undo other people's edits.
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: session.doc, field: "prose" }),
      CollaborationCaret.configure({
        provider: { awareness: session.awareness },
        user: {
          name: user?.username || user?.mail || "anonymous",
          color: session.awareness.getLocalState()?.user?.color || "#7289da",
        },
      }),
    ];
  }, [session, user]);

  const editor = useEditor(
    extensions ? { extensions, editorProps: { attributes: { class: "prose-editor" } } } : { extensions: [] },
    [extensions]
  );

  const loadHistory = async () => {
    const res = await getCodeHistory(filename, { docType: "prose" });
    if (!res?.error) setHistory(Array.isArray(res) ? res : []);
  };

  useEffect(() => {
    if (open && filename) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filename]);

  const handleSave = async () => {
    if (!editor) return;
    const markdown = htmlToMarkdown(editor.getHTML());
    if (!markdown) {
      notifyWarning("Nothing to save yet.");
      return;
    }
    // A merged draft can contain conflict blocks. Saving one as a finished
    // version would bury <<<<<<< in the middle of a paper.
    if (hasConflictMarkers(markdown)) {
      notifyError("Resolve the merge conflict markers before saving a version.");
      return;
    }
    setSaving(true);
    const res = await saveCodeVersion({
      filename,
      docType: "prose",
      language: "markdown",
      content: markdown,
      branch,
    });
    setSaving(false);
    if (res?.error) notifyError(res.error);
    else {
      notifySuccess("Version saved.");
      loadHistory();
    }
  };

  // Publishing is explicit and per-version. Until an author does this, a
  // version is unreachable without an account.
  const handleCite = async (version) => {
    const res = await setVersionCitable(version._id, !version.citable);
    if (res?.error) return notifyError(res.error);
    loadHistory();
    if (res.citable && res.citation?.url) {
      try {
        await navigator.clipboard.writeText(res.citation.text);
        notifySuccess("Published. Reference copied to your clipboard.");
      } catch {
        notifySuccess(`Published at ${res.citation.url}`);
      }
    } else {
      notifyWarning("Unpublished. The link no longer resolves.");
    }
  };

  const handleRestore = async (versionId) => {
    const v = await getCodeVersion(versionId);
    if (v?.error || !editor) return notifyError("Could not load that version.");
    // Replaces shared content, so every collaborator sees the restore.
    editor.commands.setContent(markdownToHtml(v.content));
    notifyWarning(`Loaded the version saved by ${v.username}. Save to keep it.`);
  };

  if (!open) return null;

  return (
    <Rnd
      default={{ x: 120, y: 80, width: 760, height: 560 }}
      minWidth={420}
      minHeight={320}
      bounds="window"
      style={{ zIndex: 1300 }}
    >
      <div style={{
        display: "flex", flexDirection: "column", height: "100%",
        background: "#2f3136", color: "#dcddde", borderRadius: 8,
        border: "1px solid #202225", overflow: "hidden",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 12px", borderBottom: "1px solid #202225", cursor: "move",
        }}>
          <strong>{filename || "Untitled"} · {branch}</strong>
          <div>
            <button onClick={handleSave} disabled={saving} style={btn}>
              {saving ? "Saving…" : "Save version"}
            </button>
            <button onClick={onClose} style={{ ...btn, marginLeft: 8 }}>×</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 4, padding: "6px 12px", borderBottom: "1px solid #202225", flexWrap: "wrap" }}>
          {TOOLBAR.map((t) => (
            <button
              key={t.label}
              title={t.title}
              onClick={() => editor && t.run(editor)}
              disabled={!editor}
              style={{ ...btn, background: editor && t.active(editor) ? "#5865f2" : "transparent", minWidth: 32 }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 16, background: "#36393f" }}>
          {editor
            ? <EditorContent editor={editor} />
            : <div style={{ opacity: 0.6 }}>Connecting to the shared document…</div>}
        </div>

        {history.length > 0 && (
          <div style={{ borderTop: "1px solid #202225", padding: "8px 12px", maxHeight: 130, overflow: "auto" }}>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Saved versions</div>
            {history.map((v) => (
              <div key={v._id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "2px 0" }}>
                <span>
                  {new Date(v.timestamp).toLocaleString()} · {v.username} · {v.branch}
                  {v.hasConflicts && <span style={{ color: "#ff9b9b" }}> · {v.conflictCount} conflict(s)</span>}
                </span>
                <span>
                  <button
                    onClick={() => handleCite(v)}
                    title={v.citable ? "Published — click to unpublish" : "Publish so this version can be cited"}
                    style={{ ...btn, fontSize: 12, marginRight: 6,
                             borderColor: v.citable ? "#3ba55d" : "#4f545c",
                             color: v.citable ? "#3ba55d" : "#dcddde" }}
                  >
                    {v.citable ? "Cited" : "Cite"}
                  </button>
                  <button onClick={() => handleRestore(v._id)} style={{ ...btn, fontSize: 12 }}>Load</button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Rnd>
  );
};

const btn = {
  background: "transparent",
  color: "#dcddde",
  border: "1px solid #4f545c",
  borderRadius: 4,
  padding: "3px 8px",
  cursor: "pointer",
};

export default ProseEditorPanel;
