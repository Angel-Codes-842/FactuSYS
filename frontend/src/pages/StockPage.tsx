import { useState, useMemo } from 'react'
import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, TextField,
  Chip, Snackbar, Alert, IconButton, InputAdornment,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import SearchIcon from '@mui/icons-material/Search'
import { LoadingState, EmptyState } from '../components/SharedComponents'
import { useProductos, useActualizarProducto } from '../hooks/useApi'

export default function StockPage() {
  const { data: productos, isLoading } = useProductos()
  const actualizarProducto = useActualizarProducto()
  const [search, setSearch] = useState('')
  const [snack, setSnack] = useState('')

  const filtrados = useMemo(() =>
    (productos || []).filter(p =>
      !search ||
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo.toLowerCase().includes(search.toLowerCase())
    ), [productos, search]
  )

  const ajustarStock = async (id: number, delta: number) => {
    const p = (productos || []).find((x: any) => x.id === id)
    if (!p) return
    const nuevoStock = Math.max(0, (p.cantidad_stock ?? 0) + delta)
    try {
      await actualizarProducto.mutateAsync({ id, data: { cantidad_stock: nuevoStock } })
      setSnack(delta > 0 ? 'Stock ingresado' : 'Stock retirado')
    } catch {
      setSnack('Error al ajustar stock')
    }
  }

  if (isLoading) return <LoadingState height={400} />

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <WarehouseIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Stock
        </Typography>
      </Box>

      <TextField size="small" placeholder="Buscar producto..." value={search}
        onChange={e => setSearch(e.target.value)} sx={{ mb: 2, minWidth: 280 }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> } }} />

      <TableContainer component={Paper} sx={{ overflowX: 'auto' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell align="center">Código</TableCell>
              <TableCell>Producto</TableCell>
              <TableCell align="right">Stock Actual</TableCell>
              <TableCell align="right" sx={{ width: 120 }}>Ajustar</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!filtrados || filtrados.length === 0 ? (
              <TableRow><TableCell colSpan={4}><EmptyState message={search ? 'Sin resultados' : 'Sin productos registrados'} /></TableCell></TableRow>
            ) : (filtrados ?? []).map(p => (
              <TableRow key={p.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                <TableCell align="center"><Chip label={p.codigo} size="small" variant="outlined" /></TableCell>
                <TableCell><Typography fontWeight={600}>{p.nombre}</Typography></TableCell>
                <TableCell align="right">
                  <Chip label={p.cantidad_stock ?? 0} size="small"
                    color={(p.cantidad_stock ?? 0) <= 0 ? 'error' : (p.cantidad_stock ?? 0) <= 5 ? 'warning' : 'success'} />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" color="success" onClick={() => ajustarStock(p.id, 1)}>
                    <AddIcon fontSize="small" />
                  </IconButton>
                  <IconButton size="small" color="error" onClick={() => ajustarStock(p.id, -1)}
                    disabled={(p.cantidad_stock ?? 0) <= 0}>
                    <RemoveIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity={snack.includes('Error') ? 'error' : 'success'} onClose={() => setSnack('')} sx={{ width: '100%' }}>{snack}</Alert>
      </Snackbar>
    </Box>
  )
}
