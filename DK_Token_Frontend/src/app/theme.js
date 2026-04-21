import { alpha, createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',
      dark: '#1d4ed8',
      light: '#dbeafe',
    },
    secondary: {
      main: '#0f766e',
      light: '#ccfbf1',
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
      default: '#f4f7fb',
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
    borderRadius: 14,
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          boxShadow: '0 18px 42px rgba(15, 23, 42, 0.06)',
          border: `1px solid ${alpha('#0f172a', 0.05)}`,
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 18,
          boxShadow: '0 18px 42px rgba(15, 23, 42, 0.06)',
          border: `1px solid ${alpha('#0f172a', 0.05)}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha('#ffffff', 0.92),
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
          borderRadius: 12,
          minHeight: 40,
          paddingInline: 16,
          transition: 'transform 0.16s ease, background-color 0.16s ease, border-color 0.16s ease',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
        },
        contained: {
          boxShadow: '0 10px 20px rgba(37, 99, 235, 0.12)',
        },
        outlined: {
          borderColor: alpha('#0f172a', 0.1),
          backgroundColor: '#ffffff',
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          transition: 'background-color 0.16s ease, transform 0.16s ease',
          '&:hover': {
            backgroundColor: alpha('#2563eb', 0.08),
            transform: 'translateY(-1px)',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          backgroundColor: '#ffffff',
          transition: 'border-color 0.16s ease, box-shadow 0.16s ease',
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: alpha('#2563eb', 0.3),
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
          fontWeight: 700,
          height: 30,
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
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
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
            backgroundColor: alpha('#2563eb', 0.08),
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          color: '#475467',
          backgroundColor: alpha('#0f172a', 0.02),
          fontSize: '0.78rem',
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        },
        root: {
          borderBottom: `1px solid ${alpha('#0f172a', 0.06)}`,
          paddingTop: 14,
          paddingBottom: 14,
          fontSize: '0.9rem',
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
          paddingInline: 20,
          minHeight: 60,
        },
      },
    },
  },
});

export default theme;
