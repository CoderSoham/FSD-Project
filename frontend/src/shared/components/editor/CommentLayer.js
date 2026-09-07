import React from "react";

/**
 * Inline comments on a range of lines.
 *
 * Two pieces that belong to the same feature but not to the same place in the
 * DOM. The list is a sidebar inside the editor's flex row; the composer floats
 * over the editor, anchored near the selection. Putting them in one component
 * would mean one of them rendering in the wrong parent.
 */

const lineLabel = (pos) => {
  if (!pos) return "";
  const { startLine, endLine } = pos;
  return endLine && endLine !== startLine ? `${startLine}-${endLine}` : `${startLine}`;
};

export const CommentList = ({ comments = [], currentUserId, onDelete }) => {
  if (!comments.length) return null;
  return (
    <aside className="code-panel__comments">
      <div className="version-list__head">Comments</div>
      {comments.map((c) => (
        <div className="code-panel__comment" key={c._id}>
          <div className="version-list__top">
            <span>{c.username}</span>
            <span className="list-row__meta">L{lineLabel(c.position)}</span>
          </div>
          <div>{c.text}</div>
          <div className="list-row__meta">{new Date(c.timestamp).toLocaleString()}</div>
          {c.userId === currentUserId && (
            <button className="btn btn--ghost btn--sm" onClick={() => onDelete(c._id)}>
              Delete
            </button>
          )}
        </div>
      ))}
    </aside>
  );
};

export const CommentComposer = ({ position, value, onChange, onSubmit, onCancel }) => {
  if (!position) return null;
  return (
    <div className="code-panel__comment-box">
      <div className="subtle">Comment on lines {lineLabel(position)}</div>
      <textarea
        className="field code-panel__comment-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        aria-label="Comment text"
        autoFocus
      />
      <div className="code-panel__comment-actions">
        <button className="btn btn--quiet btn--sm" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn btn--primary btn--sm" onClick={onSubmit} disabled={!value.trim()}>
          Comment
        </button>
      </div>
    </div>
  );
};

export default CommentList;
