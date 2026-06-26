import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    primary: { main: '#1565c0', light: '#1e88e5', dark: '#0d47a1' },
    secondary: { main: '#2e7d32', light: '#43a047', dark: '#1b5e20' },
    background: { default: '#f0f2f5', paper: '#ffffff' },
    error: { main: '#d32f2f' },
    warning: { main: '#f57c00' },
    info: { main: '#0288d1' },
    success: { main: '#388e3c' },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: { fontWeight: 700, fontSize: '1.6rem' },
    h5: { fontWeight: 600, fontSize: '1.25rem' },
    h6: { fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: { border: '1px solid #e0e0e0', transition: 'box-shadow 0.2s' },
      },
    },
    MuiCardContent: {
      styleOverrides: { root: { '&:last-child': { paddingBottom: 16 } } },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 8, padding: '8px 20px' },
        contained: { boxShadow: 'none', '&:hover': { boxShadow: '0 2px 8px rgba(0,0,0,0.15)' } },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600, backgroundColor: '#f5f7fa', color: '#37474f',
            fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: 0.5,
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: '10px 16px', fontSize: '0.875rem' },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, fontSize: '0.75rem' },
      },
    },
    MuiDialog: {
      defaultProps: { maxWidth: 'sm', fullWidth: true },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontSize: '1.1rem', fontWeight: 600 } },
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
        paper: {
          borderRight: '1px solid #e0e0e0',
          backgroundColor: '#fafafa',
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8, margin: '2px 8px', padding: '8px 12px',
          '&.Mui-selected': {
            backgroundColor: '#e3f2fd',
            color: '#1565c0',
            '& .MuiListItemIcon-root': { color: '#1565c0' },
            '&:hover': { backgroundColor: '#bbdefb' },
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: { minWidth: 40, color: '#546e7a' },
      },
    },
  },
})

export default theme
