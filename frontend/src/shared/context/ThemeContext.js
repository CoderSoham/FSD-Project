import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import { buildMuiTheme } from "../theme/muiTheme";

const ThemeContext = createContext();

/**
 * Owns the light/dark choice for the whole app.
 *
 * Two things have to happen on every change, and previously only the first one
 * did:
 *
 *   1. data-theme goes on the document, which switches the CSS custom
 *      properties in styles/tokens.css.
 *   2. MUI gets a rebuilt theme, because MUI components read their colours from
 *      their own theme object and know nothing about our CSS variables.
 *
 * Without the second step the sidebar, the messenger and every icon stayed on
 * MUI's default light palette while the rest of the app went dark.
 *
 * The default follows the operating system rather than assuming light. Someone
 * who has already told their machine they prefer dark should not have to tell
 * us as well.
 */
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  // The attribute has to be on the document before MUI reads the variables
  // back, so this runs in a layout-ish effect ordering: set attribute, then
  // rebuild below on the next render.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
    // Lets the browser paint form controls and scrollbars to match.
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  const muiTheme = useMemo(() => {
    // Reading computed styles requires the attribute above to be applied, which
    // it is by the time this memo re-runs after a theme change.
    document.documentElement.setAttribute("data-theme", theme);
    return buildMuiTheme(theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));

  const value = useMemo(() => ({ theme, toggleTheme, setTheme }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      <MuiThemeProvider theme={muiTheme}>{children}</MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
