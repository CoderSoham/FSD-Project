import TurndownService from "turndown";
import { marked } from "marked";

/**
 * Prose documents are versioned as Markdown, not as ProseMirror JSON.
 *
 * The version model stores a `content` string, and everything built on top of
 * it -- diffs, three-way merge, conflict blocks, the eventual git export --
 * operates on that string line by line. Storing ProseMirror JSON would work
 * mechanically and be useless in practice: a researcher reviewing what changed
 * between two drafts would be reading a diff of serialised node trees.
 *
 * Markdown keeps every one of those features legible, and it is a format the
 * work can leave the platform in.
 *
 * The live document is still rich ProseMirror content in a Yjs fragment. This
 * conversion happens only at the boundary: on save, and when loading a version.
 */

const turndown = new TurndownService({
  headingStyle: "atx",        // '# Heading', which diffs better than underlines
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
});

// Keep one sentence per line where the author wrote it that way. Reflowing
// paragraphs would make a one-word change look like the whole paragraph moved.
turndown.addRule("preserveLineBreaks", {
  filter: ["br"],
  replacement: () => "  \n",
});

marked.setOptions({ breaks: true, gfm: true });

/** Editor HTML -> Markdown, for storing a version. */
export const htmlToMarkdown = (html) => {
  if (!html) return "";
  return turndown.turndown(html).trim();
};

/** Markdown -> HTML, for loading a version back into the editor. */
export const markdownToHtml = (markdown) => {
  if (!markdown) return "";
  return marked.parse(markdown);
};

/**
 * Does this Markdown carry unresolved conflict markers from a merge?
 *
 * Prose inherits the same three-way merge as code, so a merged draft can
 * contain conflict blocks. Saving one as if it were finished prose would bury
 * `<<<<<<<` in the middle of a paper.
 */
export const hasConflictMarkers = (markdown) =>
  /^<{7}(\s|$)/m.test(markdown || "") || /^>{7}(\s|$)/m.test(markdown || "");
