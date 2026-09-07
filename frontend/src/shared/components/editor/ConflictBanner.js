import React from "react";

/**
 * Shown after a merge that could not be resolved automatically.
 *
 * The server does a real three way merge against the version the two branches
 * diverged from, so a merge can come back with conflict blocks written into the
 * document. Accepting that quietly would leave someone staring at <<<<<<< in
 * the middle of their paper with no idea where it came from.
 */
const ConflictBanner = ({ count = 0, sourceBranch, onDismiss }) => {
  if (!count) return null;
  return (
    <div className="notice notice--danger" role="alert">
      <span>
        <strong>{count}</strong> unresolved conflict{count === 1 ? "" : "s"} from
        merging <strong>{sourceBranch}</strong>. Search for{" "}
        <code>&lt;&lt;&lt;&lt;&lt;&lt;&lt;</code> and resolve each block before saving.
      </span>
      {onDismiss && (
        <button className="btn btn--ghost btn--sm" onClick={onDismiss}>
          Dismiss
        </button>
      )}
    </div>
  );
};

export default ConflictBanner;
