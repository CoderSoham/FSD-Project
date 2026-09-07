import { htmlToMarkdown, markdownToHtml, hasConflictMarkers } from "./prose";

/**
 * Prose versions are stored as Markdown so that diffs, three-way merge and the
 * git export all keep working on prose the way they do on code. That only holds
 * if the conversion is stable: if saving and loading the same document twice
 * produced different Markdown, every save would show a spurious diff.
 */

describe("html to markdown", () => {
  it("uses hash headings, which diff line by line", () => {
    // Underline style headings put the change on a different line from the
    // text, so a one word edit to a heading reads as two changed lines.
    expect(htmlToMarkdown("<h1>Results</h1>")).toBe("# Results");
    expect(htmlToMarkdown("<h2>Method</h2>")).toBe("## Method");
  });

  it("keeps emphasis", () => {
    expect(htmlToMarkdown("<p><strong>bold</strong> and <em>italic</em></p>"))
      .toBe("**bold** and *italic*");
  });

  it("uses one bullet marker rather than alternating", () => {
    // Turndown pads the marker out to the indent width, so the assertion is
    // about which character starts the line, not about the spacing after it.
    const md = htmlToMarkdown("<ul><li>one</li><li>two</li></ul>");
    const markers = md.split("\n").map((line) => line.trim()[0]);
    expect(markers).toEqual(["-", "-"]);
    expect(md).toContain("one");
    expect(md).toContain("two");
  });

  it("fences code blocks", () => {
    expect(htmlToMarkdown("<pre><code>x = 1</code></pre>")).toContain("```");
  });

  it("returns an empty string for empty input rather than throwing", () => {
    expect(htmlToMarkdown("")).toBe("");
    expect(htmlToMarkdown(null)).toBe("");
    expect(htmlToMarkdown(undefined)).toBe("");
  });
});

describe("round trip", () => {
  it("is stable, so saving an unchanged document produces no diff", () => {
    const original = "# Results\n\nThe **effect** was clear.\n\n- one\n- two";
    const once = htmlToMarkdown(markdownToHtml(original));
    const twice = htmlToMarkdown(markdownToHtml(once));
    // The first pass may normalise. The second must not change anything, or
    // every save would look like an edit.
    expect(twice).toBe(once);
  });

  it("preserves the words themselves", () => {
    const original = "# Results\n\nThe effect was clear.";
    const back = htmlToMarkdown(markdownToHtml(original));
    expect(back).toContain("Results");
    expect(back).toContain("The effect was clear.");
  });
});

describe("conflict markers", () => {
  it("finds an unresolved block from a merge", () => {
    const merged = [
      "# Results",
      "<<<<<<< main",
      "The effect was clear.",
      "=======",
      "The effect was marginal.",
      ">>>>>>> revision",
    ].join("\n");
    expect(hasConflictMarkers(merged)).toBe(true);
  });

  it("does not fire on prose that merely mentions angle brackets", () => {
    // A paper about diffs will contain these characters. Refusing to save it
    // would be worse than the problem the check exists to prevent.
    expect(hasConflictMarkers("Use `<<<` to compare, or a << b in C.")).toBe(false);
    expect(hasConflictMarkers("The value <<<<<<< is inline, not at the start."))
      .toBe(false);
  });

  it("catches the closing marker on its own", () => {
    // A partial resolution can leave one side behind.
    expect(hasConflictMarkers("text\n>>>>>>> revision\nmore")).toBe(true);
  });

  it("is quiet on clean prose and on nothing", () => {
    expect(hasConflictMarkers("# A clean draft\n\nNothing to see.")).toBe(false);
    expect(hasConflictMarkers("")).toBe(false);
    expect(hasConflictMarkers(null)).toBe(false);
  });
});
