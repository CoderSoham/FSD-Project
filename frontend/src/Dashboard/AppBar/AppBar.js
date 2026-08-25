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
  height: "48px",
  borderBottom: "1px solid var(--color-border)",
  backgroundColor: "var(--color-surface-alt)",
  width: "calc(100% - 326px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 15px",
  boxShadow: "0 2px 8px var(--color-shadow)",
  transition: "background 0.3s, box-shadow 0.3s, border 0.3s"
});

const ThemeToggleButton = styled("button")({
  background: "none",
  border: "none",
  color: "var(--color-text)",
  cursor: "pointer",
  fontSize: "1.2rem",
  marginLeft: "16px",
  padding: "6px 12px",
  borderRadius: "6px",
  transition: "background 0.2s, color 0.2s",
  ':hover': {
    background: "var(--color-surface)",
    color: "var(--color-primary)"
  }
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
            className="modern-btn"
            style={{ marginLeft: 16, marginRight: 8, padding: '6px 16px', fontWeight: 600 }}
            onClick={() => setEditorOpen(true)}
            title="Open Code Editor"
          >
            {'</>'} Code
          </button>
          <ThemeToggleButton onClick={toggleTheme} title="Toggle dark/light mode">
            {theme === "light" ? "🌞" : "🌙"}
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
