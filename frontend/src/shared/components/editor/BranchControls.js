import React, { useState } from "react";

/**
 * Branch, merge and compare.
 *
 * These three sat in the same toolbar row as the file controls, so saving a
 * version and merging a branch looked equally important. They are not. Keeping
 * them on their own row is most of the reason the panel reads as calm now.
 *
 * The draft state for each action lives here rather than in the parent. The
 * parent only cares about the finished value, and it does not need three more
 * pieces of state to find that out.
 */
const BranchControls = ({
  branches = ["main"],
  currentBranch = "main",
  onSwitchBranch,
  onCreateBranch,
  onMerge,
  onCompare,
  canBranch = true,
}) => {
  const [newBranchName, setNewBranchName] = useState("");
  const [mergeSource, setMergeSource] = useState("");
  const [compareBranch, setCompareBranch] = useState("");

  const others = branches.filter((b) => b !== currentBranch);
  const trimmed = newBranchName.trim();

  const create = () => {
    if (!trimmed || !canBranch) return;
    onCreateBranch(trimmed);
    setNewBranchName("");
  };

  return (
    <div className="panel__toolbar code-panel__branches">
      <label className="subtle code-panel__label" htmlFor="cp-branch">
        Branch
      </label>
      <select
        id="cp-branch"
        className="field"
        value={currentBranch}
        onChange={(e) => onSwitchBranch(e.target.value)}
      >
        {branches.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>

      <input
        className="field code-panel__newbranch"
        value={newBranchName}
        onChange={(e) => setNewBranchName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && create()}
        placeholder="New branch name"
        aria-label="New branch name"
      />
      <button
        className="btn btn--quiet btn--sm"
        onClick={create}
        disabled={!trimmed || !canBranch}
        title={
          canBranch
            ? "Branch from the current version"
            : "Save a version before branching from it"
        }
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
        {others.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <button
        className="btn btn--quiet btn--sm"
        onClick={() => mergeSource && onMerge(mergeSource)}
        disabled={!mergeSource}
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
        {others.map((b) => (
          <option key={b} value={b}>
            {b}
          </option>
        ))}
      </select>
      <button
        className="btn btn--quiet btn--sm"
        onClick={() => compareBranch && onCompare(compareBranch)}
        disabled={!compareBranch}
      >
        Compare
      </button>
    </div>
  );
};

export default BranchControls;
