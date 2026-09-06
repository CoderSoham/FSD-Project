import { createTheme } from "@mui/material/styles";

/**
 * Build an MUI theme from the CSS custom properties in styles/tokens.css.
 *
 * The app uses MUI for the sidebar, the messenger and every icon button, but it
 * never created an MUI theme. So while the custom ThemeContext was setting
 * data-theme on the document and driving the CSS variables, every MUI component
 * carried on rendering with MUI's own default light palette. Toggling the theme
 * changed half the screen and left the other half alone.
 *
 * Rather than writing the palette out a second time in JavaScript, this reads
 * the values back out of the stylesheet. tokens.css stays the only place a
 * colour is defined, so adding a token there is enough for MUI to see it too.
 */

const read = (name, fallback = "") => {
  if (typeof window === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
};

export const buildMuiTheme = (mode) =>
  createTheme({
    palette: {
      mode,
      primary: { main: read("--accent", "#4f46e5"), contrastText: read("--text-on-accent", "#fff") },
      error: { main: read("--danger", "#dc2626") },
      warning: { main: read("--warning", "#b45309") },
      success: { main: read("--success", "#15803d") },
      background: {
        default: read("--bg", "#f7f8fa"),
        paper: read("--surface", "#ffffff"),
      },
      text: {
        primary: read("--text", "#16181d"),
        secondary: read("--text-muted", "#5b6270"),
        disabled: read("--text-subtle", "#868d9b"),
      },
      divider: read("--border", "#e2e5eb"),
    },

    shape: { borderRadius: parseInt(read("--radius-md", "8"), 10) || 8 },

    typography: {
      fontFamily: read("--font-sans", "Inter, system-ui, sans-serif"),
      fontSize: parseInt(read("--text-base", "14"), 10) || 14,
      button: { textTransform: "none", fontWeight: 500 },
    },

    components: {
      // MUI's default buttons carry uppercase text and a drop shadow, which
      // reads as a 2014 Material app. Neither belongs here.
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: { root: { textTransform: "none" } },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: "var(--text-muted)",
            "&:hover": { background: "var(--surface-hover)", color: "var(--text)" },
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            background: "var(--surface-active)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            fontSize: "var(--text-xs)",
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            background: "var(--surface-raised)",
            border: "1px solid var(--border)",
            backgroundImage: "none", // MUI adds a lightening gradient in dark mode
          },
        },
      },
    },
  });
