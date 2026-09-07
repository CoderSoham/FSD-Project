import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ConflictBanner from "./ConflictBanner";

/**
 * A merge that produced conflicts writes <<<<<<< blocks into the document. If
 * that happens without saying so, the next thing the author sees is those
 * markers in the middle of their paper with no idea where they came from.
 */

describe("ConflictBanner", () => {
  it("stays out of the way when a merge was clean", () => {
    const { container } = render(<ConflictBanner count={0} sourceBranch="results" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says how many conflicts there are and which branch caused them", () => {
    render(<ConflictBanner count={3} sourceBranch="results" onDismiss={() => {}} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/conflicts/)).toBeInTheDocument();
    expect(screen.getByText("results")).toBeInTheDocument();
  });

  it("gets the singular right, because '1 conflicts' looks broken", () => {
    render(<ConflictBanner count={1} sourceBranch="results" onDismiss={() => {}} />);
    expect(screen.getByText(/conflict[^s]/)).toBeInTheDocument();
  });

  it("tells the author what to search for", () => {
    render(<ConflictBanner count={1} sourceBranch="results" onDismiss={() => {}} />);
    expect(screen.getByText("<<<<<<<")).toBeInTheDocument();
  });

  it("announces itself, since it appears without the reader looking for it", () => {
    render(<ConflictBanner count={2} sourceBranch="results" onDismiss={() => {}} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("can be dismissed", () => {
    const onDismiss = jest.fn();
    render(<ConflictBanner count={2} sourceBranch="results" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it("hides the dismiss button when there is nothing to dismiss to", () => {
    render(<ConflictBanner count={2} sourceBranch="results" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
