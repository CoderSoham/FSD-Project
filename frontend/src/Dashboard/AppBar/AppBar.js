import React from "react";
import { styled } from "@mui/system";
import DropdownMenu from "./DropdownMenu";
import ChosenOptionLabel from "./ChosenOptionLabel";
import { useTheme } from "../../shared/context/ThemeContext";
import CodeEditorPanel from "../../shared/components/CodeEditorPanel";
import { useState } from "react";

const MainContainer = styled("div")({
  position: "absolute",
  right: "0",
  top: "0",
  height: "var(--appbar-height)",
  borderBottom: "1px solid var(--border)",
  backgroundColor: "var(--surface)",
  // Driven by the chrome width token rather than a hardcoded 326px, which no
  // longer matched the sidebars and left the bar starting in the wrong place.
  left: "var(--chrome-width)",
  width: "auto",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  gap: "var(--space-2)",
  padding: "0 var(--space-4)"
});

const ThemeToggleButton = styled("button")({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "32px",
  height: "32px",
  background: "none",
  border: "1px solid transparent",
  borderRadius: "var(--radius-md)",
  color: "var(--text-muted)",
  cursor: "pointer",
  transition: "background var(--duration) var(--ease), color var(--duration) var(--ease)",
  "&:hover": { background: "var(--surface-hover)", color: "var(--text)" },
});

const AppBar = () => {
  const { theme, toggleTheme } = useTheme();
  const [editorOpen, setEditorOpen] = useState(false);
  const [code, setCode] = useState('// Start coding!');
  const [language, setLanguage] = useState('javascript');
  return (
    <>
      <MainContainer>
        <ChosenOptionLabel />
        <div style={{ display: "flex", alignItems: "center" }}>
          <DropdownMenu />
          <button
            className="btn btn--quiet"
            onClick={() => setEditorOpen(true)}
            title="Open the code editor"
          >
            Code
          </button>
          <ThemeToggleButton
            onClick={toggleTheme}
            title={theme === "light" ? "Switch to dark" : "Switch to light"}
            aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
          >
            {theme === "light" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"
                  stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </ThemeToggleButton>
        </div>
      </MainContainer>
      <CodeEditorPanel
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        language={language}
        setLanguage={setLanguage}
        value={code}
        onChange={setCode}
      />
    </>
  );
};

export default AppBar;
