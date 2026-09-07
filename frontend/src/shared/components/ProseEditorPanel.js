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
import VersionHistoryList from "./editor/VersionHistoryList";

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
      notifyError("Not connected. Open a room first.");
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
      default={{ x: 120, y: 80, width: 780, height: 580 }}
      minWidth={440}
      minHeight={340}
      bounds="window"
      dragHandleClassName="panel__header"
      style={{ zIndex: "var(--z-panel)" }}
    >
      <div className="panel">
        <header className="panel__header">
          <div className="panel__title">
            <span>{filename || "Untitled"}</span>
            <span className="panel__title-meta mono">{branch}</span>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)" }}>
            <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving" : "Save version"}
            </button>
            <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label="Close">
              &times;
            </button>
          </div>
        </header>

        <div className="panel__toolbar" role="toolbar" aria-label="Formatting">
          {TOOLBAR.map((t) => (
            <button
              key={t.label}
              type="button"
              title={t.title}
              aria-label={t.title}
              aria-pressed={Boolean(editor && t.active(editor))}
              onClick={() => editor && t.run(editor)}
              disabled={!editor}
              className={`btn btn--sm btn--icon ${editor && t.active(editor) ? "btn--on" : "btn--ghost"}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="panel__body" style={{ padding: "var(--space-5)" }}>
          {editor
            ? <EditorContent editor={editor} />
            : <div className="empty-state">Connecting to the shared document</div>}
        </div>

        {history.length > 0 && (
          <div className="panel__footer">
            <VersionHistoryList
              versions={history}
              layout="rows"
              title="Saved versions"
              renderActions={(v) => (
                <>
                  <button
                    className={`btn btn--sm ${v.citable ? "btn--on" : "btn--quiet"}`}
                    onClick={() => handleCite(v)}
                    title={
                      v.citable
                        ? "Published. Click to unpublish."
                        : "Publish so this version can be cited"
                    }
                  >
                    {v.citable ? "Cited" : "Cite"}
                  </button>
                  <button className="btn btn--sm btn--quiet" onClick={() => handleRestore(v._id)}>
                    Load
                  </button>
                </>
              )}
            />
          </div>
        )}

      </div>
    </Rnd>
  );
};

export default ProseEditorPanel;
