import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import BranchControls from "./BranchControls";

const setup = (over = {}) => {
  const props = {
    branches: ["main", "results", "revision"],
    currentBranch: "main",
    onSwitchBranch: jest.fn(),
    onCreateBranch: jest.fn(),
    onMerge: jest.fn(),
    onCompare: jest.fn(),
    canBranch: true,
    ...over,
  };
  render(<BranchControls {...props} />);
  return props;
};

describe("BranchControls", () => {
  it("switches branch", () => {
    const { onSwitchBranch } = setup();
    fireEvent.change(screen.getByLabelText("Branch"), { target: { value: "results" } });
    expect(onSwitchBranch).toHaveBeenCalledWith("results");
  });

  it("creates a branch and clears the field afterwards", () => {
    const { onCreateBranch } = setup();
    const input = screen.getByLabelText("New branch name");
    fireEvent.change(input, { target: { value: "draft-2" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(onCreateBranch).toHaveBeenCalledWith("draft-2");
    expect(input).toHaveValue("");
  });

  it("trims the name, because a branch called '  x  ' cannot be addressed later", () => {
    const { onCreateBranch } = setup();
    fireEvent.change(screen.getByLabelText("New branch name"), {
      target: { value: "  draft  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(onCreateBranch).toHaveBeenCalledWith("draft");
  });

  it("refuses a name that is only whitespace", () => {
    const { onCreateBranch } = setup();
    fireEvent.change(screen.getByLabelText("New branch name"), { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(onCreateBranch).not.toHaveBeenCalled();
  });

  it("cannot branch before there is a version to branch from", () => {
    const { onCreateBranch } = setup({ canBranch: false });
    fireEvent.change(screen.getByLabelText("New branch name"), { target: { value: "draft" } });
    const create = screen.getByRole("button", { name: "Create" });
    expect(create).toBeDisabled();
    expect(create).toHaveAttribute("title", expect.stringMatching(/save a version/i));
    fireEvent.click(create);
    expect(onCreateBranch).not.toHaveBeenCalled();
  });

  it("takes Enter in the name field as Create", () => {
    const { onCreateBranch } = setup();
    const input = screen.getByLabelText("New branch name");
    fireEvent.change(input, { target: { value: "draft" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onCreateBranch).toHaveBeenCalledWith("draft");
  });

  it("never offers the current branch as a merge source", () => {
    setup();
    const options = Array.from(
      screen.getByLabelText("Branch to merge in").querySelectorAll("option")
    ).map((o) => o.value);
    expect(options).not.toContain("main");
    expect(options).toEqual(expect.arrayContaining(["results", "revision"]));
  });

  it("never offers the current branch to compare against itself", () => {
    setup();
    const options = Array.from(
      screen.getByLabelText("Branch to compare against").querySelectorAll("option")
    ).map((o) => o.value);
    expect(options).not.toContain("main");
  });

  it("merges the chosen branch", () => {
    const { onMerge } = setup();
    fireEvent.change(screen.getByLabelText("Branch to merge in"), {
      target: { value: "results" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Merge" }));
    expect(onMerge).toHaveBeenCalledWith("results");
  });

  it("keeps Merge and Compare disabled until something is chosen", () => {
    setup();
    expect(screen.getByRole("button", { name: "Merge" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Compare" })).toBeDisabled();
  });

  it("compares against the chosen branch", () => {
    const { onCompare } = setup();
    fireEvent.change(screen.getByLabelText("Branch to compare against"), {
      target: { value: "revision" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    expect(onCompare).toHaveBeenCalledWith("revision");
  });

  it("copes with a document that only has main", () => {
    setup({ branches: ["main"] });
    expect(screen.getByRole("button", { name: "Merge" })).toBeDisabled();
  });
});
