import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route } from "react-router-dom";
import CitedVersionPage from "./CitedVersionPage";
import { getPublicVersion } from "../api";

jest.mock("../api", () => ({ getPublicVersion: jest.fn() }));

/**
 * The only screen someone can reach without an account, and the thing a
 * reference in a paper actually opens. If it is wrong, it is wrong in public
 * and permanently, because the citation has already been printed.
 */

const version = (over = {}) => ({
  _id: "v1",
  filename: "paper.md",
  username: "ada",
  branch: "main",
  docType: "prose",
  content: "# Results\n\nThe effect was clear.",
  contentHash: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
  timestamp: "2026-09-01T10:00:00.000Z",
  citation: {
    shortHash: "9f86d0818840",
    text: "ada (2026). paper.md, version v1.",
    bibtex: "@misc{ada2026, title={paper.md} }",
  },
  ...over,
});

const show = (id = "v1") =>
  render(
    <MemoryRouter initialEntries={[`/v/${id}`]}>
      <Route path="/v/:versionId" component={CitedVersionPage} />
    </MemoryRouter>
  );

beforeEach(() => jest.clearAllMocks());

describe("while loading", () => {
  it("holds the space the content will take instead of saying 'Loading'", async () => {
    getPublicVersion.mockReturnValue(new Promise(() => {}));
    show();
    expect(screen.getByLabelText("Loading")).toHaveAttribute("aria-busy", "true");
  });
});

describe("a version that was never published", () => {
  it("says so without implying the reader did something wrong", async () => {
    getPublicVersion.mockResolvedValue({ error: "Not found" });
    show();
    await waitFor(() => expect(screen.getByText("Not available")).toBeInTheDocument());
    expect(screen.getByText(/has not published it for citation/i)).toBeInTheDocument();
  });

  it("does not leak the filename of something unpublished", async () => {
    getPublicVersion.mockResolvedValue({ error: "Not found" });
    show();
    await waitFor(() => expect(screen.getByText("Not available")).toBeInTheDocument());
    expect(screen.queryByText("paper.md")).not.toBeInTheDocument();
  });
});

describe("a published version", () => {
  it("shows the filename, author and branch", async () => {
    getPublicVersion.mockResolvedValue(version());
    show();
    await waitFor(() => expect(screen.getByText("paper.md")).toBeInTheDocument());
    expect(screen.getByText("ada")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
  });

  it("shows the content hash, which is the whole point of citing a version", async () => {
    // Without this a reader cannot tell whether the text in front of them is
    // the text the citation referred to.
    getPublicVersion.mockResolvedValue(version());
    show();
    await waitFor(() => expect(screen.getByText("9f86d0818840")).toBeInTheDocument());
  });

  it("renders prose as prose rather than as a wall of markdown", async () => {
    getPublicVersion.mockResolvedValue(version());
    const { container } = show();
    await waitFor(() => expect(container.querySelector(".prose-readonly")).toBeInTheDocument());
    // Scoped to the article. The page title is also an h1, so an unscoped
    // query finds the filename and passes for the wrong reason.
    expect(container.querySelector(".prose-readonly h1")).toHaveTextContent("Results");
  });

  it("renders code as code, unrendered", async () => {
    getPublicVersion.mockResolvedValue(
      version({ docType: "code", filename: "analysis.py", content: "# not a heading\nx = 1" })
    );
    const { container } = show();
    await waitFor(() => expect(container.querySelector(".cited__code")).toBeInTheDocument());
    // A Python comment must not become an HTML heading.
    expect(container.querySelector(".prose-readonly")).not.toBeInTheDocument();
    expect(screen.getByText(/x = 1/)).toBeInTheDocument();
  });

  it("offers both a reference and a BibTeX entry", async () => {
    getPublicVersion.mockResolvedValue(version());
    show();
    await waitFor(() => expect(screen.getByText("Reference")).toBeInTheDocument());
    expect(screen.getByText("BibTeX")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Copy" })).toHaveLength(2);
  });

  it("copies the reference and says it did", async () => {
    getPublicVersion.mockResolvedValue(version());
    const writeText = jest.fn().mockResolvedValue();
    Object.assign(navigator, { clipboard: { writeText } });

    show();
    await waitFor(() => expect(screen.getByText("Reference")).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole("button", { name: "Copy" })[0]);

    await waitFor(() => expect(screen.getByText("Copied")).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith("ada (2026). paper.md, version v1.");
  });

  it("does not offer to copy a citation the server did not send", async () => {
    getPublicVersion.mockResolvedValue(version({ citation: { text: "ada (2026)." } }));
    show();
    await waitFor(() => expect(screen.getByText("Reference")).toBeInTheDocument());
    expect(screen.queryByText("BibTeX")).not.toBeInTheDocument();
  });

  it("falls back to the first bytes of the hash when the server sent no short form", async () => {
    const v = version({ citation: {} });
    getPublicVersion.mockResolvedValue(v);
    show();
    await waitFor(() =>
      expect(screen.getByText(v.contentHash.slice(0, 12))).toBeInTheDocument()
    );
  });
});
