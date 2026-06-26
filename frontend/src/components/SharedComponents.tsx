import { Box, Typography, CircularProgress, Button, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import InboxIcon from '@mui/icons-material/Inbox'

export function LoadingState({ height = 300 }: { height?: number | string }) {
  return (
    <Box display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: height }}>
      <CircularProgress size={36} />
    </Box>
  )
}

export function EmptyState({ message = 'Sin datos', action }: { message?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" sx={{ py: 8, opacity: 0.6 }}>
      <InboxIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
      <Typography variant="body1" color="text.secondary" sx={{ mb: action ? 2 : 0 }}>{message}</Typography>
      {action && (
        <Button variant="outlined" size="small" onClick={action.onClick}>{action.label}</Button>
      )}
    </Box>
  )
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar',
  onConfirm, onCancel, color = 'error',
}: {
  open: boolean; title: string; message: string;
  confirmLabel?: string; cancelLabel?: string;
  onConfirm: () => void; onCancel: () => void;
  color?: 'error' | 'warning' | 'primary' | 'success';
}) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent><Typography>{message}</Typography></DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="inherit">{cancelLabel}</Button>
        <Button variant="contained" color={color} onClick={onConfirm}>{confirmLabel}</Button>
      </DialogActions>
    </Dialog>
  )
}
