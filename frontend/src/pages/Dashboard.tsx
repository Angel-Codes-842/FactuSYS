import { useState, useEffect } from 'react'
import {
  Grid2, Card, CardContent, Typography, Box, Skeleton, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Button,
} from '@mui/material'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ReceiptIcon from '@mui/icons-material/Receipt'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import PeopleIcon from '@mui/icons-material/People'
import RequestQuoteIcon from '@mui/icons-material/RequestQuote'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import api from '../services/api'
import { useNavigate } from 'react-router-dom'
import { LoadingState } from '../components/SharedComponents'

interface DashboardData {
  ventas_hoy: { total: number; cantidad: number }
  ventas_mes: { total: number; cantidad: number }
  ventas_pendientes: { total: number; cantidad: number }
  creditos_pendientes: number
  compras_mes: { total: number; cantidad: number }
  compras_pendientes: number
  productos_stock_bajo: number
  presupuestos_pendientes: number
  clientes_registrados: number
  ultimas_facturas: any[]
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/reportes/dashboard/').then(r => setData(r.data)).catch(() => {})
  }, [])

  const cards = data ? [
    {
      title: 'Ventas Hoy',
      value: `Gs. ${data.ventas_hoy.total.toLocaleString('es-PY', { minimumFractionDigits: 0 })}`,
      subtitle: `${data.ventas_hoy.cantidad} facturas`,
      icon: <PointOfSaleIcon />,
      bgColor: '#e8f5e9', iconColor: '#2e7d32',
    },
    {
      title: 'Ventas del Mes',
      value: `Gs. ${data.ventas_mes.total.toLocaleString('es-PY', { minimumFractionDigits: 0 })}`,
      subtitle: `${data.ventas_mes.cantidad} facturas`,
      icon: <CalendarMonthIcon />,
      bgColor: '#e8f5e9', iconColor: '#1b5e20',
    },
    {
      title: 'Ventas Pendientes',
      value: `Gs. ${data.ventas_pendientes.total.toLocaleString('es-PY', { minimumFractionDigits: 0 })}`,
      subtitle: `${data.ventas_pendientes.cantidad} facturas`,
      icon: <ReceiptLongIcon />,
      bgColor: '#fff3e0', iconColor: '#f57c00',
    },
    {
      title: 'Créditos Pendientes',
      value: `${data.creditos_pendientes || 0}`,
      subtitle: 'facturas a cobrar',
      icon: <AccountBalanceIcon />,
      bgColor: '#e3f2fd', iconColor: '#1565c0',
    },
    {
      title: 'Presupuestos Pendientes',
      value: `${data.presupuestos_pendientes}`,
      subtitle: 'por convertir',
      icon: <RequestQuoteIcon />,
      bgColor: '#f3e5f5', iconColor: '#7b1fa2',
    },
    {
      title: 'Compras del Mes',
      value: `Gs. ${data.compras_mes.total.toLocaleString('es-PY', { minimumFractionDigits: 0 })}`,
      subtitle: `${data.compras_mes.cantidad} compras`,
      icon: <ShoppingCartIcon />,
      bgColor: '#e0f2f1', iconColor: '#00695c',
    },
    {
      title: 'Stock Bajo',
      value: `${data.productos_stock_bajo}`,
      subtitle: 'productos con ≤ 5 unidades',
      icon: <WarningAmberIcon />,
      bgColor: '#fce4ec', iconColor: '#d32f2f',
    },
    {
      title: 'Clientes Activos',
      value: `${data.clientes_registrados}`,
      subtitle: 'registrados',
      icon: <PeopleIcon />,
      bgColor: '#e8eaf6', iconColor: '#283593',
    },
  ] : []

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={0.5}>Dashboard</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>Pilar, Paraguay — Guaraní (PYG)</Typography>

      <Grid2 container spacing={3} mb={4}>
        {!data ? Array.from({ length: 8 }).map((_, i) => (
          <Grid2 size={{ xs: 12, sm: 6, md: 3 }} key={i}>
            <Card><CardContent><Skeleton height={80} /></CardContent></Card>
          </Grid2>
        )) : cards.map(card => (
          <Grid2 size={{ xs: 12, sm: 6, md: 3 }} key={card.title}>
            <Card sx={{ '&:hover': { boxShadow: '0 4px 20px rgba(0,0,0,0.08)' } }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: card.bgColor, color: card.iconColor, display: 'flex' }}>
                  {card.icon}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>{card.title}</Typography>
                  <Typography variant="h5" fontWeight={700} mt={0.3}>{card.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{card.subtitle}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid2>
        ))}
      </Grid2>

      <Grid2 container spacing={3}>
        <Grid2 size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={1.5}>
                <Typography variant="h6">
                  <ReceiptIcon sx={{ verticalAlign: 'middle', mr: 1, color: 'primary.main' }} />
                  Últimas Facturas
                </Typography>
                <Button size="small" onClick={() => navigate('/facturas')}>Ver todas</Button>
              </Box>
              {!data ? <LoadingState height={100} /> : !data.ultimas_facturas?.length ? (
                <Typography variant="body2" color="text.secondary">Sin facturas recientes</Typography>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell align="center">Nº</TableCell>
                        <TableCell>Cliente</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell align="center">Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.ultimas_facturas.map((f: any) => (
                        <TableRow key={f.id} hover sx={{ '&:last-child td': { border: 0 } }}>
                          <TableCell align="center"><Chip label={f.numero} size="small" variant="outlined" /></TableCell>
                          <TableCell><Typography fontWeight={500} variant="body2">{f.cliente_nombre || 'Consumidor Final'}</Typography></TableCell>
                          <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>Gs. {Number(f.total).toLocaleString('es-PY')}</TableCell>
                          <TableCell align="center"><Chip label={f.estado} size="small" color={f.estado === 'emitido' ? 'default' : f.estado === 'pagada' ? 'success' : f.estado === 'pendiente' ? 'warning' : 'error'} /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid2>
      </Grid2>
    </Box>
  )
}
