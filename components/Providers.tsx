"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";

// Identité « l'onde triée » : mêmes valeurs que les tokens Tailwind de app/globals.css.
const c = {
  night: "#0b0d10",
  stage: "#14171c",
  hollow: "#0f1216",
  edge: "#20242c",
  line: "#2a303a",
  ink: "#eef1f5",
  soft: "#c4cad4",
  muted: "#8b93a1",
  aqua: "#2ee6d6",
  lilac: "#a69bff",
};
const display = '"Bricolage Grotesque", "Geist", system-ui, sans-serif';

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: c.aqua, contrastText: "#04201d" },
    secondary: { main: c.lilac, contrastText: "#120e2b" },
    success: { main: "#4ade80" },
    warning: { main: "#f5b544" },
    error: { main: "#ff6b6b" },
    info: { main: c.lilac },
    background: { default: c.night, paper: c.stage },
    text: { primary: c.ink, secondary: c.muted },
    divider: c.edge,
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Geist", system-ui, -apple-system, "Segoe UI", sans-serif',
    h1: { fontFamily: display, fontWeight: 700, letterSpacing: "-0.02em" },
    h2: { fontFamily: display, fontWeight: 700, letterSpacing: "-0.02em" },
    h3: { fontFamily: display, fontWeight: 650, letterSpacing: "-0.01em" },
    h4: { fontFamily: display, fontWeight: 650, letterSpacing: "-0.01em" },
    h5: { fontFamily: display, fontWeight: 650, letterSpacing: "-0.01em" },
    h6: { fontFamily: display, fontWeight: 650, letterSpacing: "-0.01em" },
    button: { textTransform: "none", fontWeight: 650, letterSpacing: 0 },
  },
  components: {
    MuiCssBaseline: { styleOverrides: { body: { backgroundColor: c.night } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: { root: { borderRadius: 20, border: `1px solid ${c.edge}`, backgroundColor: c.stage } },
    },
    MuiCardContent: { styleOverrides: { root: { padding: 22, "&:last-child": { paddingBottom: 22 } } } },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: {
          borderRadius: 999,
          minHeight: 44,
          paddingInline: 20,
          fontSize: 14.5,
          variants: [
            { props: { size: "small" }, style: { minHeight: 36, paddingInline: 14, fontSize: 13.5 } },
            { props: { size: "large" }, style: { minHeight: 54, paddingInline: 24, fontSize: 15.5 } },
            {
              props: { variant: "contained", color: "primary" },
              style: { boxShadow: "0 10px 30px -12px rgba(46,230,214,0.7)", "&:hover": { backgroundColor: "#7ff3e8" } },
            },
            {
              props: { variant: "outlined", color: "secondary" },
              style: { borderColor: "rgba(166,155,255,0.45)", backgroundColor: "rgba(166,155,255,0.08)", color: "#d2ccff" },
            },
            { props: { variant: "outlined", color: "inherit" }, style: { borderColor: c.line, color: c.soft } },
          ],
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { borderRadius: 999, fontWeight: 500 },
        outlined: { borderColor: c.line },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: c.hollow,
          "& .MuiOutlinedInput-notchedOutline": { borderColor: c.line },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#3a414c" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderWidth: 1 },
          "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(46,230,214,0.15)" },
        },
        input: { paddingBlock: 12.5 }, // champs de 48 px, comme la maquette
      },
    },
    MuiInputLabel: { styleOverrides: { root: { color: c.soft } } },
    MuiFormHelperText: { styleOverrides: { root: { marginInline: 2, color: c.muted } } },
    // Switch 46 × 28 de la maquette ; secondary (lilas) pour le dry run.
    MuiSwitch: {
      styleOverrides: {
        root: { width: 46, height: 28, padding: 0, flex: "none" },
        switchBase: {
          padding: 3,
          color: c.muted,
          "&.Mui-checked": { transform: "translateX(18px)", color: c.night },
          "&.Mui-checked + .MuiSwitch-track": { opacity: 1 },
        },
        thumb: { width: 22, height: 22, boxShadow: "none" },
        track: { borderRadius: 999, backgroundColor: c.line, opacity: 1 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          alignItems: "center",
          border: "1px solid transparent",
          variants: [
            { props: { severity: "info" }, style: { backgroundColor: "rgba(166,155,255,0.07)", borderColor: "rgba(166,155,255,0.25)", color: "#d8d3ff" } },
            { props: { severity: "warning" }, style: { backgroundColor: "rgba(245,181,68,0.08)", borderColor: "rgba(245,181,68,0.3)", color: "#f5d699" } },
            { props: { severity: "error" }, style: { backgroundColor: "rgba(255,107,107,0.08)", borderColor: "rgba(255,107,107,0.3)", color: "#ffc2c2" } },
            { props: { severity: "success" }, style: { backgroundColor: "rgba(74,222,128,0.08)", borderColor: "rgba(74,222,128,0.3)", color: "#bdf5d2" } },
          ],
        },
      },
    },
    MuiPopover: {
      styleOverrides: {
        paper: { borderRadius: 16, backgroundColor: "#1b1f26", border: "1px solid #2f3540", boxShadow: "0 24px 60px -12px rgba(0,0,0,0.7)" },
      },
    },
    MuiAutocomplete: {
      styleOverrides: {
        paper: { borderRadius: 14, backgroundColor: "#1b1f26", border: "1px solid #2f3540" },
        tag: { borderRadius: 999, backgroundColor: "rgba(46,230,214,0.14)", color: "#dffbf8" },
      },
    },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 24, border: `1px solid ${c.edge}` } } },
  },
});

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ enableCssLayer: true }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
