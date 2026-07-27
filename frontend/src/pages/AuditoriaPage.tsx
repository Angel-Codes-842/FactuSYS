import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, Chip, CircularProgress
} from '@mui/material'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useAuditLogs } from '../hooks/useApi'

interface AuditLog {
  id: number
  usuario_nombre: string
  accion: string
  modelo: string
  registro_id: string
  detalles: string
  fecha: string
}

export default function AuditoriaPage() {
  const { data: logs, isLoading } = useAuditLogs()

  const getActionColor = (action: string) => {
    if (action.includes('ANULAR') || action.includes('DELETE')) return 'error'
    if (action.includes('MODIFICAR') || action.includes('UPDATE')) return 'warning'
    return 'default'
  }

  if (isLoading) return <Box display="flex" justifyContent="center" mt={4}><CircularProgress /></Box>

  return (
    <Box>
      <Typography variant="h4" mb={3}>Registro de Auditoría</Typography>
      <Card>
        <CardContent>
          <TableContainer component={Paper} elevation={0}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Fecha y Hora</TableCell>
                  <TableCell>Usuario</TableCell>
                  <TableCell>Acción</TableCell>
                  <TableCell>Módulo</TableCell>
                  <TableCell>Registro</TableCell>
                  <TableCell>Detalles</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">No hay registros de auditoría aún.</TableCell>
                  </TableRow>
                ) : logs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell>{format(new Date(log.fecha), "dd MMM yyyy, HH:mm", { locale: es })}</TableCell>
                    <TableCell>{log.usuario_nombre}</TableCell>
                    <TableCell>
                      <Chip label={log.accion} size="small" color={getActionColor(log.accion) as any} />
                    </TableCell>
                    <TableCell>{log.modelo}</TableCell>
                    <TableCell><strong>{log.registro_id}</strong></TableCell>
                    <TableCell sx={{ maxWidth: 250, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {log.detalles}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  )
}
