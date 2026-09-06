import React from "react";
import { styled } from "@mui/system";

const Wrapper = styled("div")({
  flexGrow: 1,
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "var(--space-3)",
  padding: "var(--space-6)",
  textAlign: "center",
});

/**
 * Shown when no conversation is open.
 *
 * This used to be a single line of white text floating in the middle of a large
 * empty area, which measured 1.06:1 against the background in light mode and
 * told the user nothing about what the product does. An empty state is the
 * first thing a new user reads, so it should explain the place they have landed
 * in and what to do next.
 */
const WelcomeMessage = () => (
  <Wrapper>
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
        stroke="var(--text-subtle)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
    <div>
      <div style={{ fontSize: "var(--text-md)", fontWeight: 600, marginBottom: "var(--space-1)" }}>
        No conversation open
      </div>
      <div style={{ color: "var(--text-muted)", fontSize: "var(--text-sm)", maxWidth: "34ch" }}>
        Pick someone from the sidebar to start talking, or open the code editor
        to work on a shared document.
      </div>
    </div>
  </Wrapper>
);

export default WelcomeMessage;
