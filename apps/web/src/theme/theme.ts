import { createTheme, alpha } from '@mui/material/styles';
import type { PaletteMode } from '@mui/material';

/**
 * AnatoView MUI Theme — modern design system with light/dark support.
 *
 * Design principles:
 *   - Soft, layered shadows for depth
 *   - Smooth transitions on all interactive elements
 *   - Refined typography with tighter letter-spacing
 *   - Consistent border radius language (8/12/16)
 *   - Subtle hover states with lift effects
 */
export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: {
        main: isDark ? '#5DADE2' : '#1B4F72',
        light: '#85C1E9',
        dark: '#154360',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: '#2ECC71',
        light: '#58D68D',
        dark: '#239B56',
        contrastText: '#FFFFFF',
      },
      error: {
        main: '#E74C3C',
        light: '#F1948A',
        dark: '#CB4335',
      },
      warning: {
        main: '#F39C12',
        light: '#F8C471',
        dark: '#D68910',
      },
      success: {
        main: '#27AE60',
        light: '#82E0AA',
        dark: '#1E8449',
      },
      background: {
        default: isDark ? '#0F1117' : '#F0F2F5',
        paper: isDark ? '#1A1D27' : '#FFFFFF',
      },
      text: {
        primary: isDark ? '#E8EAED' : '#1A202C',
        secondary: isDark ? '#9AA0A8' : '#64748B',
      },
      divider: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
    },
    typography: {
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      h1: {
        fontSize: '2.25rem',
        fontWeight: 800,
        letterSpacing: '-0.025em',
        lineHeight: 1.2,
      },
      h2: {
        fontSize: '1.875rem',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        lineHeight: 1.25,
      },
      h3: {
        fontSize: '1.5rem',
        fontWeight: 700,
        letterSpacing: '-0.015em',
        lineHeight: 1.3,
      },
      h4: {
        fontSize: '1.25rem',
        fontWeight: 700,
        letterSpacing: '-0.01em',
        lineHeight: 1.35,
      },
      h5: {
        fontSize: '1.1rem',
        fontWeight: 600,
        letterSpacing: '-0.005em',
      },
      h6: {
        fontSize: '0.95rem',
        fontWeight: 600,
        letterSpacing: '0',
      },
      subtitle1: {
        fontSize: '1rem',
        fontWeight: 500,
        letterSpacing: '-0.005em',
      },
      subtitle2: {
        fontSize: '0.875rem',
        fontWeight: 600,
        letterSpacing: '0.01em',
      },
      body1: {
        fontSize: '0.938rem',
        lineHeight: 1.6,
      },
      body2: {
        fontSize: '0.8125rem',
        lineHeight: 1.6,
      },
      caption: {
        fontSize: '0.75rem',
        fontWeight: 500,
        letterSpacing: '0.02em',
        lineHeight: 1.5,
      },
      overline: {
        fontSize: '0.6875rem',
        fontWeight: 700,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
        letterSpacing: '0.01em',
      },
    },
    shape: {
      borderRadius: 10,
    },
    shadows: [
      'none',
      isDark
        ? '0 1px 2px rgba(0,0,0,0.3)'
        : '0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)',
      isDark
        ? '0 2px 4px rgba(0,0,0,0.35)'
        : '0 1px 5px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.06)',
      isDark
        ? '0 4px 6px rgba(0,0,0,0.4)'
        : '0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -1px rgba(0,0,0,0.04)',
      isDark
        ? '0 6px 12px rgba(0,0,0,0.45)'
        : '0 10px 15px -3px rgba(0,0,0,0.06), 0 4px 6px -2px rgba(0,0,0,0.04)',
      isDark
        ? '0 8px 16px rgba(0,0,0,0.5)'
        : '0 10px 25px -5px rgba(0,0,0,0.07), 0 4px 10px -3px rgba(0,0,0,0.04)',
      // 6–24: less commonly used, keep consistent
      ...Array(19).fill(
        isDark
          ? '0 12px 24px rgba(0,0,0,0.55)'
          : '0 20px 40px -8px rgba(0,0,0,0.08), 0 8px 16px -4px rgba(0,0,0,0.04)'
      ),
    ] as any,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            scrollbarWidth: 'thin',
            '&::-webkit-scrollbar': {
              width: '6px',
              height: '6px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)',
              borderRadius: '3px',
            },
          },
          '*': {
            transition: 'background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease',
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
        styleOverrides: {
          root: {
            borderRadius: 10,
            padding: '8px 20px',
            fontWeight: 600,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          },
          contained: {
            boxShadow: 'none',
            '&:hover': {
              boxShadow: isDark
                ? '0 4px 12px rgba(93, 173, 226, 0.3)'
                : '0 4px 12px rgba(27, 79, 114, 0.25)',
              transform: 'translateY(-1px)',
            },
            '&:active': {
              transform: 'translateY(0)',
            },
          },
          outlined: {
            borderWidth: '1.5px',
            '&:hover': {
              borderWidth: '1.5px',
              transform: 'translateY(-1px)',
            },
          },
          sizeSmall: {
            padding: '5px 14px',
            fontSize: '0.8125rem',
          },
          sizeLarge: {
            padding: '12px 28px',
            fontSize: '1rem',
          },
        },
      },
      MuiCard: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            borderRadius: 14,
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
            backgroundImage: 'none',
          },
        },
      },
      MuiPaper: {
        defaultProps: {
          elevation: 0,
        },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
          outlined: {
            borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            boxShadow: 'none',
            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
            backdropFilter: 'blur(12px)',
            backgroundColor: isDark
              ? alpha('#1A1D27', 0.85)
              : alpha('#FFFFFF', 0.85),
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            borderRight: 'none',
            backgroundColor: isDark ? '#141720' : '#FAFBFC',
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            borderRadius: 8,
            fontSize: '0.75rem',
          },
          sizeSmall: {
            height: 24,
            fontSize: '0.7rem',
          },
          outlined: {
            borderWidth: '1.5px',
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: 'all 0.15s ease',
            '&:hover': {
              backgroundColor: isDark
                ? 'rgba(255,255,255,0.04)'
                : 'rgba(0,0,0,0.03)',
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 10,
              transition: 'box-shadow 0.2s ease',
              '&.Mui-focused': {
                boxShadow: isDark
                  ? '0 0 0 3px rgba(93, 173, 226, 0.2)'
                  : '0 0 0 3px rgba(27, 79, 114, 0.1)',
              },
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            borderRadius: 10,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          },
          head: {
            fontWeight: 700,
            fontSize: '0.75rem',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: isDark ? '#9AA0A8' : '#64748B',
            backgroundColor: isDark ? '#141720' : '#F8FAFC',
          },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: {
            transition: 'background-color 0.15s ease',
          },
        },
      },
      MuiSkeleton: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiAlert: {
        styleOverrides: {
          root: {
            borderRadius: 12,
          },
          standardInfo: {
            backgroundColor: isDark ? alpha('#5DADE2', 0.08) : alpha('#1B4F72', 0.04),
          },
          standardError: {
            backgroundColor: isDark ? alpha('#E74C3C', 0.08) : alpha('#E74C3C', 0.04),
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
          },
        },
      },
      MuiAvatar: {
        styleOverrides: {
          root: {
            fontSize: '0.875rem',
            fontWeight: 700,
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            borderRadius: 8,
            fontSize: '0.75rem',
            fontWeight: 500,
            padding: '6px 12px',
          },
        },
      },
    },
  });
}

// Default light theme for backward compatibility
const theme = createAppTheme('light');
export default theme;
