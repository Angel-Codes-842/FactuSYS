import { createTheme, type PaletteMode } from '@mui/material/styles'

export const getTheme = (mode: PaletteMode) => createTheme({
  palette: {
    mode,
    primary: {
      main: mode === 'dark' ? '#4f9cf9' : '#1a6fc4',
      light: mode === 'dark' ? '#7db9fb' : '#4f9cf9',
      dark: mode === 'dark' ? '#1a6fc4' : '#0d4a8a',
    },
    secondary: {
      main: mode === 'dark' ? '#30d890' : '#0ea47a',
      light: mode === 'dark' ? '#6ae8b0' : '#30d890',
      dark: mode === 'dark' ? '#0ea47a' : '#077053',
    },
    background: {
      default: mode === 'dark' ? '#111827' : '#f0f4f8',
      paper: mode === 'dark' ? '#1f2937' : '#ffffff',
    },
    error: { main: '#ef4444' },
    warning: { main: '#f59e0b' },
    info: { main: '#3b82f6' },
    success: { main: '#10b981' },
    text: {
      primary: mode === 'dark' ? '#f1f5f9' : '#1e293b',
      secondary: mode === 'dark' ? '#94a3b8' : '#64748b',
    },
    divider: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 800, fontSize: '1.65rem', letterSpacing: '-0.02em' },
    h5: { fontWeight: 700, fontSize: '1.25rem' },
    h6: { fontWeight: 700, letterSpacing: '-0.01em' },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: '0.01em' },
    body2: { fontSize: '0.875rem' },
    caption: { fontSize: '0.75rem' },
  },
  components: {
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: ({ theme }) => ({
          border: `1px solid ${theme.palette.divider}`,
          transition: 'box-shadow 0.25s ease, transform 0.15s ease',
          '&:hover': {
            boxShadow: mode === 'dark'
              ? '0 4px 24px rgba(0,0,0,0.4)'
              : '0 4px 24px rgba(0,0,0,0.08)',
          },
        }),
      },
    },
    MuiCardContent: {
      styleOverrides: { root: { '&:last-child': { paddingBottom: 16 } } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 10, padding: '8px 20px', transition: 'all 0.2s ease' },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: '0 4px 14px rgba(0,0,0,0.2)', transform: 'translateY(-1px)' },
          '&:active': { transform: 'translateY(0)' },
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: ({ theme }) => ({
          '& .MuiTableCell-head': {
            fontWeight: 700,
            backgroundColor: mode === 'dark' ? theme.palette.background.default : '#f8fafc',
            color: theme.palette.text.secondary,
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          },
        }),
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: '10px 16px', fontSize: '0.875rem' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          transition: 'background-color 0.15s',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: '0.72rem', borderRadius: 8 },
      },
    },
    MuiDialog: {
      defaultProps: { maxWidth: 'sm', fullWidth: true },
      styleOverrides: {
        paper: { 
          borderRadius: 16, 
          boxShadow: mode === 'dark' ? '0 16px 48px rgba(0,0,0,0.4)' : '0 12px 48px rgba(0,0,0,0.15)' 
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: { 
        root: { 
          fontSize: '1.25rem', 
          fontWeight: 800, 
          padding: '20px 24px 16px', 
          letterSpacing: '-0.02em',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        } 
      },
    },
    MuiDialogContent: {
      defaultProps: { dividers: true },
      styleOverrides: {
        root: { 
          padding: '24px',
          paddingTop: '20px !important', // Asegurar espacio superior incluso con dividers
          '& .MuiFormControl-root, & .MuiTextField-root': {
            marginBottom: '4px'
          }
        },
        dividers: ({ theme }) => ({
          borderColor: theme.palette.divider
        })
      },
    },
    MuiDialogActions: {
      styleOverrides: {
        root: { 
          padding: '16px 24px',
          backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
          borderTop: `1px solid ${mode === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`
        }
      }
    },
    MuiTextField: {
      defaultProps: { variant: 'outlined', size: 'small', fullWidth: true },
    },
    MuiSelect: {
      defaultProps: { size: 'small' },
    },
    MuiFormControl: {
      defaultProps: { size: 'small' },
    },
    MuiSnackbar: {
      defaultProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'center' } },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: ({ theme }) => ({
          borderRight: `1px solid ${theme.palette.divider}`,
          backgroundColor: mode === 'dark' ? '#161d2b' : '#fafbfc',
        }),
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: mode === 'dark'
            ? 'linear-gradient(135deg, #1a2744 0%, #0f172a 100%)'
            : 'linear-gradient(135deg, #1a6fc4 0%, #0d4a8a 100%)',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: ({ theme }) => ({
          borderRadius: 10,
          margin: '2px 8px',
          padding: '8px 12px',
          transition: 'all 0.15s ease',
          '&.Mui-selected': {
            backgroundColor: mode === 'dark'
              ? 'rgba(79, 156, 249, 0.15)'
              : 'rgba(26, 111, 196, 0.10)',
            color: theme.palette.primary.main,
            '& .MuiListItemIcon-root': { color: theme.palette.primary.main },
            '&:hover': {
              backgroundColor: mode === 'dark'
                ? 'rgba(79, 156, 249, 0.22)'
                : 'rgba(26, 111, 196, 0.16)',
            },
          },
          '&:hover': {
            backgroundColor: mode === 'dark'
              ? 'rgba(255,255,255,0.05)'
              : 'rgba(0,0,0,0.04)',
          },
        }),
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: { minWidth: 40, color: 'text.secondary' },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 10 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        rounded: { borderRadius: 12 },
      },
    },
  },
})

// Tema por defecto (modo claro) para compatibilidad con código existente
const theme = getTheme('light')
export default theme
