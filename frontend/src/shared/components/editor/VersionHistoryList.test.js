import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import VersionHistoryList from "./VersionHistoryList";

const version = (over = {}) => ({
  _id: "v1",
  username: "ada",
  branch: "main",
  timestamp: "2026-09-01T10:00:00.000Z",
  ...over,
});

/**
 * Both editors show this list. It used to be written twice, once in each panel,
 * and the two copies had already diverged: the code editor showed conflict
 * counts and the prose editor did not, so the same version looked clean in one
 * place and broken in the other.
 */

describe("VersionHistoryList", () => {
  it("says nothing has been saved rather than showing an empty box", () => {
    render(<VersionHistoryList versions={[]} />);
    expect(screen.getByText(/no versions saved yet/i)).toBeInTheDocument();
  });

  it("shows a placeholder while loading instead of the empty message", () => {
    render(<VersionHistoryList versions={[]} loading />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(screen.queryByText(/no versions saved yet/i)).not.toBeInTheDocument();
  });

  it("lists who saved each version", () => {
    render(
      <VersionHistoryList
        versions={[version({ _id: "a", username: "ada" }), version({ _id: "b", username: "grace" })]}
      />
    );
    expect(screen.getByText("ada")).toBeInTheDocument();
    expect(screen.getByText("grace")).toBeInTheDocument();
  });

  it("marks the newest version as current, since the API returns newest first", () => {
    render(
      <VersionHistoryList
        versions={[version({ _id: "new" }), version({ _id: "old", username: "grace" })]}
      />
    );
    expect(screen.getAllByText("current")).toHaveLength(1);
  });

  it("marks whichever version it is told to, when that is not the newest", () => {
    const { container } = render(
      <VersionHistoryList
        versions={[version({ _id: "new" }), version({ _id: "old", username: "grace" })]}
        currentId="old"
      />
    );
    const current = container.querySelector(".version-list__item--current");
    expect(current).toHaveTextContent("grace");
  });

  it("shows conflict counts in both layouts", () => {
    for (const layout of ["sidebar", "rows"]) {
      const { unmount } = render(
        <VersionHistoryList
          layout={layout}
          versions={[version({ hasConflicts: true, conflictCount: 2 })]}
        />
      );
      expect(screen.getByText(/2 conflicts/)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders the buttons the parent supplies, per version", () => {
    const onPick = jest.fn();
    render(
      <VersionHistoryList
        versions={[version({ _id: "a" }), version({ _id: "b", username: "grace" })]}
        renderActions={(v) => (
          <button onClick={() => onPick(v._id)}>Load {v._id}</button>
        )}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Load b" }));
    expect(onPick).toHaveBeenCalledWith("b");
  });

  it("is fine with a parent that supplies no buttons at all", () => {
    render(<VersionHistoryList versions={[version()]} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the branch in the compact layout, where versions from several branches mix", () => {
    render(
      <VersionHistoryList layout="rows" versions={[version({ branch: "results" })]} />
    );
    expect(screen.getByText("results")).toBeInTheDocument();
  });
});
