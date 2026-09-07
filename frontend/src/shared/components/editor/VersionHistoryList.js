import React from "react";
import "./editor.css";

/**
 * The list of saved versions for a document.
 *
 * Both editors show version history and both had written their own. The code
 * editor renders it as a sidebar of stacked cards, the prose editor as rows
 * along the bottom of the panel, and the two had drifted: one showed conflict
 * counts, the other did not.
 *
 * The shape differs but the content does not, so the layout is a prop and the
 * per-version buttons come in through `renderActions`. Nothing here fetches
 * anything or knows what a branch is.
 *
 * @param versions      newest first, the order the API returns them in
 * @param loading       show a placeholder instead of an empty list
 * @param currentId     the version to mark as the one being edited
 * @param layout        "sidebar" for stacked cards, "rows" for a compact list
 * @param renderActions (version, index) => node, for buttons per version
 */
const VersionHistoryList = ({
  versions = [],
  loading = false,
  currentId = null,
  layout = "sidebar",
  title = "Version history",
  emptyText = "No versions saved yet",
  renderActions,
}) => {
  if (loading) return <div className="empty-state">Loading</div>;
  if (!versions.length) return <div className="empty-state">{emptyText}</div>;

  const conflictBadge = (v) =>
    v.hasConflicts ? (
      <span className="badge badge--danger">
        {v.conflictCount} conflict{v.conflictCount === 1 ? "" : "s"}
      </span>
    ) : null;

  if (layout === "rows") {
    return (
      <div className="version-list version-list--rows">
        <div className="version-list__head">{title}</div>
        {versions.map((v, idx) => (
          <div className="list-row" key={v._id}>
            <span className="list-row__meta">
              {new Date(v.timestamp).toLocaleString()} &middot; {v.username} &middot;{" "}
              <span className="mono">{v.branch}</span> {conflictBadge(v)}
            </span>
            <span className="version-list__actions">
              {renderActions ? renderActions(v, idx) : null}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="version-list">
      <div className="version-list__head">{title}</div>
      {versions.map((v, idx) => {
        const isCurrent = currentId ? v._id === currentId : idx === 0;
        return (
          <div
            key={v._id}
            className={`version-list__item${isCurrent ? " version-list__item--current" : ""}`}
          >
            <div className="version-list__top">
              <span>{v.username}</span>
              {isCurrent && <span className="badge badge--accent">current</span>}
            </div>
            <div className="list-row__meta">{new Date(v.timestamp).toLocaleString()}</div>
            {conflictBadge(v)}
            {renderActions ? renderActions(v, idx) : null}
          </div>
        );
      })}
    </div>
  );
};

export default VersionHistoryList;
