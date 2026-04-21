import { alpha, createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2457d6',
      dark: '#1d46ab',
      light: '#edf3ff',
    },
    secondary: {
      main: '#0f766e',
      light: '#e8faf7',
    },
    success: {
      main: '#15803d',
      light: '#dcfce7',
    },
    warning: {
      main: '#d97706',
      light: '#fef3c7',
    },
    error: {
      main: '#dc2626',
      dark: '#991b1b',
      light: '#fee2e2',
    },
    info: {
      main: '#2563eb',
      light: '#dbeafe',
    },
    background: {
      default: '#f7f8fb',
      paper: '#ffffff',
    },
    text: {
      primary: '#111827',
      secondary: '#667085',
    },
    divider: alpha('#0f172a', 0.08),
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", sans-serif',
    h2: {
      fontSize: '2.25rem',
      fontWeight: 800,
      letterSpacing: '-0.04em',
    },
    h3: {
      fontSize: '2rem',
      fontWeight: 800,
      letterSpacing: '-0.04em',
    },
    h4: {
      fontSize: '1.75rem',
      fontWeight: 800,
      letterSpacing: '-0.03em',
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 700,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 700,
    },
    subtitle1: {
      fontWeight: 600,
    },
    subtitle2: {
      fontWeight: 600,
      letterSpacing: '0.01em',
    },
    body1: {
      fontSize: '0.95rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.55,
    },
    caption: {
      fontSize: '0.75rem',
      fontWeight: 600,
      letterSpacing: '0.02em',
    },
    button: {
      fontWeight: 700,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 6px 20px rgba(15, 23, 42, 0.03)',
          border: 'none',
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 6px 20px rgba(15, 23, 42, 0.03)',
          border: 'none',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#ffffff', 0.88),
          color: '#111827',
          boxShadow: 'none',
          backgroundImage: 'none',
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
          minHeight: 38,
          paddingInline: 14,
          transition: 'transform 0.16s ease, background-color 0.16s ease, border-color 0.16s ease',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
        contained: {
          boxShadow: '0 8px 18px rgba(36, 87, 214, 0.12)',
        },
        text: {
          paddingInline: 8,
        },
        outlined: {
          borderColor: alpha('#0f172a', 0.1),
          backgroundColor: alpha('#ffffff', 0.92),
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'background-color 0.16s ease, transform 0.16s ease',
          '&:hover': {
            backgroundColor: alpha('#2457d6', 0.06),
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: alpha('#ffffff', 0.92),
          transition: 'border-color 0.16s ease, box-shadow 0.16s ease',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#2457d6', 0.26),
          },
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#0f172a', 0.08),
          },
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          color: '#667085',
        },
      },
    },
    MuiChip: {
      defaultProps: {
        size: 'small',
      },
      styleOverrides: {
        root: {
          borderRadius: 999,
          fontWeight: 600,
          height: 28,
          letterSpacing: '0.01em',
        },
        filledDefault: {
          backgroundColor: alpha('#0f172a', 0.06),
          color: '#344054',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRadius: 0,
          backgroundColor: '#fbfcfe',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'background-color 0.16s ease, transform 0.16s ease',
          '&:hover': {
            transform: 'translateX(1px)',
          },
        },
      },
    },
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          marginInline: 6,
          marginBlock: 2,
          minHeight: 40,
          '&:hover': {
            backgroundColor: alpha('#2457d6', 0.06),
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          color: '#475467',
          backgroundColor: alpha('#ffffff', 0.96),
          fontSize: '0.78rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        },
        root: {
          borderBottom: `1px solid ${alpha('#0f172a', 0.05)}`,
          paddingTop: 11,
          paddingBottom: 11,
          fontSize: '0.88rem',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.16s ease',
        },
      },
    },
    MuiTablePagination: {
      styleOverrides: {
        toolbar: {
          paddingInline: 16,
          minHeight: 56,
        },
      },
    },
  },
});

export default theme;
