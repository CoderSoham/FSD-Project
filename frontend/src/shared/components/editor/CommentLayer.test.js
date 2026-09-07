import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommentList, CommentComposer } from "./CommentLayer";

const comment = (over = {}) => ({
  _id: "c1",
  username: "grace",
  userId: "u-grace",
  text: "This needs a citation.",
  position: { startLine: 4, startColumn: 1, endLine: 4, endColumn: 20 },
  timestamp: "2026-09-01T10:00:00.000Z",
  ...over,
});

describe("CommentList", () => {
  it("renders nothing at all when there are no comments", () => {
    // The sidebar takes 240px of the editor's width. An empty one is worse
    // than no one at all.
    const { container } = render(<CommentList comments={[]} currentUserId="u-ada" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows who said what", () => {
    render(<CommentList comments={[comment()]} currentUserId="u-ada" onDelete={jest.fn()} />);
    expect(screen.getByText("grace")).toBeInTheDocument();
    expect(screen.getByText("This needs a citation.")).toBeInTheDocument();
  });

  it("shows a single line as one number, not as a range of one", () => {
    render(
      <CommentList
        comments={[comment({ position: { startLine: 4, endLine: 4 } })]}
        currentUserId="u-ada"
      />
    );
    expect(screen.getByText("L4")).toBeInTheDocument();
  });

  it("shows a multi line selection as a range", () => {
    render(
      <CommentList
        comments={[comment({ position: { startLine: 4, endLine: 9 } })]}
        currentUserId="u-ada"
      />
    );
    expect(screen.getByText("L4-9")).toBeInTheDocument();
  });

  it("only offers Delete on your own comments", () => {
    render(
      <CommentList
        comments={[comment({ _id: "a", userId: "u-grace" }), comment({ _id: "b", userId: "u-ada", username: "ada" })]}
        currentUserId="u-ada"
        onDelete={jest.fn()}
      />
    );
    expect(screen.getAllByRole("button", { name: /delete/i })).toHaveLength(1);
  });

  it("deletes the comment that was clicked", () => {
    const onDelete = jest.fn();
    render(
      <CommentList comments={[comment({ _id: "mine", userId: "u-ada" })]} currentUserId="u-ada" onDelete={onDelete} />
    );
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith("mine");
  });
});

describe("CommentComposer", () => {
  const setup = (over = {}) => {
    const props = {
      position: { startLine: 4, endLine: 6 },
      value: "",
      onChange: jest.fn(),
      onSubmit: jest.fn(),
      onCancel: jest.fn(),
      ...over,
    };
    render(<CommentComposer {...props} />);
    return props;
  };

  it("stays closed until a range has been selected", () => {
    const { container } = render(<CommentComposer position={null} value="" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("says which lines the comment is about", () => {
    setup();
    expect(screen.getByText(/lines 4-6/)).toBeInTheDocument();
  });

  it("reports typing to the parent", () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText("Comment text"), { target: { value: "hm" } });
    expect(onChange).toHaveBeenCalledWith("hm");
  });

  it("will not submit an empty comment", () => {
    const { onSubmit } = setup({ value: "   " });
    const button = screen.getByRole("button", { name: "Comment" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits a real one", () => {
    const { onSubmit } = setup({ value: "Needs a citation" });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("can be cancelled", () => {
    const { onCancel } = setup({ value: "half written" });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
