import React from "react";
import DiffViewer from "react-diff-viewer";
import "./editor.css";

const isDark = () =>
  typeof document !== "undefined" &&
  document.documentElement.getAttribute("data-theme") === "dark";

/**
 * A side by side diff, used both for two versions on one branch and for the
 * tips of two branches. The only thing that changes between those cases is what
 * goes in the header, so it is a prop.
 */
const DiffPane = ({ label, oldValue, newValue, leftTitle, rightTitle, onClose }) => (
  <div className="diff-pane">
    <div className="diff-pane__head">
      <span className="mono">{label}</span>
      <button className="btn btn--quiet btn--sm" onClick={onClose}>
        Close
      </button>
    </div>
    <DiffViewer
      oldValue={oldValue || ""}
      newValue={newValue || ""}
      splitView
      useDarkTheme={isDark()}
      leftTitle={leftTitle}
      rightTitle={rightTitle}
    />
  </div>
);

export default DiffPane;
