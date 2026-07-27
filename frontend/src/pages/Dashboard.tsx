import {
  Grid2, Card, CardContent, Typography, Box, Skeleton, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Button, Tooltip, useTheme
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
import AddBoxIcon from '@mui/icons-material/AddBox'
import PersonAddIcon from '@mui/icons-material/PersonAdd'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import { useNavigate } from 'react-router-dom'
import { LoadingState } from '../components/SharedComponents'
import { useDashboard, useVentas7Dias, useEmpresaConfig } from '../hooks/useApi'

export default function Dashboard() {
  const { data, isLoading } = useDashboard()
  const { data: config } = useEmpresaConfig()
  const { data: chartData } = useVentas7Dias()
  const navigate = useNavigate()
  const theme = useTheme()

  const maxChartValue = Math.max(...(chartData ?? []).map(d => d.total), 1)

  const cards = data ? [
    {
      title: 'Ventas Hoy',
      value: `Gs. ${data.ventas_hoy.total.toLocaleString('es-PY', { minimumFractionDigits: 0 })}`,
      subtitle: `${data.ventas_hoy.cantidad} facturas`,
      icon: <PointOfSaleIcon />,
      bgColor: theme.palette.mode === 'dark' ? 'rgba(46, 125, 50, 0.2)' : '#e8f5e9', 
      iconColor: theme.palette.mode === 'dark' ? '#81c784' : '#2e7d32',
    },
    {
      title: 'Ventas del Mes',
      value: `Gs. ${data.ventas_mes.total.toLocaleString('es-PY', { minimumFractionDigits: 0 })}`,
      subtitle: `${data.ventas_mes.cantidad} facturas`,
      icon: <CalendarMonthIcon />,
      bgColor: theme.palette.mode === 'dark' ? 'rgba(27, 94, 32, 0.2)' : '#e8f5e9', 
      iconColor: theme.palette.mode === 'dark' ? '#4caf50' : '#1b5e20',
    },
    {
      title: 'Ventas Pendientes',
      value: `Gs. ${data.ventas_pendientes.total.toLocaleString('es-PY', { minimumFractionDigits: 0 })}`,
      subtitle: `${data.ventas_pendientes.cantidad} facturas`,
      icon: <ReceiptLongIcon />,
      bgColor: theme.palette.mode === 'dark' ? 'rgba(245, 124, 0, 0.2)' : '#fff3e0', 
      iconColor: theme.palette.mode === 'dark' ? '#ffb74d' : '#f57c00',
    },
    {
      title: 'Créditos Pendientes',
      value: `${data.creditos_pendientes || 0}`,
      subtitle: 'facturas a cobrar',
      icon: <AccountBalanceIcon />,
      bgColor: theme.palette.mode === 'dark' ? 'rgba(21, 101, 192, 0.2)' : '#e3f2fd', 
      iconColor: theme.palette.mode === 'dark' ? '#64b5f6' : '#1565c0',
    },
    {
      title: 'Presupuestos Pendientes',
      value: `${data.presupuestos_pendientes}`,
      subtitle: 'por convertir',
      icon: <RequestQuoteIcon />,
      bgColor: theme.palette.mode === 'dark' ? 'rgba(123, 31, 162, 0.2)' : '#f3e5f5', 
      iconColor: theme.palette.mode === 'dark' ? '#ba68c8' : '#7b1fa2',
    },
    {
      title: 'Compras del Mes',
      value: `Gs. ${data.compras_mes.total.toLocaleString('es-PY', { minimumFractionDigits: 0 })}`,
      subtitle: `${data.compras_mes.cantidad} compras`,
      icon: <ShoppingCartIcon />,
      bgColor: theme.palette.mode === 'dark' ? 'rgba(0, 105, 92, 0.2)' : '#e0f2f1', 
      iconColor: theme.palette.mode === 'dark' ? '#4db6ac' : '#00695c',
    },
    {
      title: 'Stock Bajo',
      value: `${data.productos_stock_bajo}`,
      subtitle: 'productos con ≤ 5 unidades',
      icon: <WarningAmberIcon />,
      bgColor: theme.palette.mode === 'dark' ? 'rgba(211, 47, 47, 0.2)' : '#fce4ec', 
      iconColor: theme.palette.mode === 'dark' ? '#e57373' : '#d32f2f',
    },
    {
      title: 'Clientes Activos',
      value: `${data.clientes_registrados}`,
      subtitle: 'registrados',
      icon: <PeopleIcon />,
      bgColor: theme.palette.mode === 'dark' ? 'rgba(40, 53, 147, 0.2)' : '#e8eaf6', 
      iconColor: theme.palette.mode === 'dark' ? '#7986cb' : '#283593',
    },
  ] : []

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="flex-end" mb={3}>
        <Box>
          <Typography variant="h4" fontWeight="bold" mb={0.5}>Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            {config ? `${config.nombre} — ${config.ciudad} — Guaraní (PYG)` : 'Cargando...'}
          </Typography>
        </Box>
        
        <Box display={{ xs: 'none', md: 'flex' }} gap={2}>
          <Button variant="contained" startIcon={<PointOfSaleIcon />} onClick={() => navigate('/ventas')}>Nueva Venta</Button>
          <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => navigate('/clientes')}>Nuevo Cliente</Button>
          <Button variant="outlined" startIcon={<AddBoxIcon />} onClick={() => navigate('/productos')}>Nuevo Producto</Button>
        </Box>
      </Box>

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
                  <Typography variant="h5" fontWeight={800} mt={0.3}>{card.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{card.subtitle}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid2>
        ))}
      </Grid2>

      <Grid2 container spacing={3}>
        <Grid2 size={{ xs: 12, md: 8 }}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1 }}>
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

        <Grid2 size={{ xs: 12, md: 4 }}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" mb={2}>
                <TrendingUpIcon sx={{ verticalAlign: 'middle', mr: 1, color: 'primary.main' }} />
                Ventas (Últimos 7 días)
              </Typography>
              
              {!chartData?.length ? (
                <LoadingState height={100} />
              ) : (
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', pt: 4, pb: 1, gap: 1 }}>
                  {chartData?.map((d, i) => {
                    const heightPercent = Math.max((d.total / maxChartValue) * 100, 2)
                    return (
                      <Tooltip key={i} title={`${d.fecha}: Gs. ${d.total.toLocaleString('es-PY')}`} arrow placement="top">
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', flex: 1 }}>
                          <Typography variant="caption" color="text.secondary" fontWeight={500} mb={1} sx={{ opacity: d.total > 0 ? 1 : 0 }}>
                            {d.total > 0 ? (d.total >= 1000000 ? `${(d.total/1000000).toFixed(1)}M` : `${(d.total/1000).toFixed(0)}k`) : ''}
                          </Typography>
                          <Box 
                            sx={{ 
                              width: '100%', 
                              maxWidth: 32, 
                              height: `${heightPercent}%`, 
                              minHeight: '20px',
                              bgcolor: d.total > 0 ? 'primary.main' : 'divider',
                              borderRadius: '4px 4px 0 0',
                              transition: 'all 0.3s ease',
                              '&:hover': { bgcolor: 'primary.light', transform: 'scaleY(1.05)', transformOrigin: 'bottom' }
                            }} 
                          />
                          <Typography variant="caption" mt={1} color="text.secondary" fontSize="0.65rem">{d.fecha}</Typography>
                        </Box>
                      </Tooltip>
                    )
                  })}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid2>
      </Grid2>
      
      {/* Mobile Quick Actions */}
      <Box display={{ xs: 'flex', md: 'none' }} gap={2} mt={3} overflow="auto" pb={2}>
        <Button variant="contained" startIcon={<PointOfSaleIcon />} onClick={() => navigate('/ventas')} sx={{ minWidth: 150 }}>Vender</Button>
        <Button variant="outlined" startIcon={<PersonAddIcon />} onClick={() => navigate('/clientes')} sx={{ minWidth: 150 }}>Cliente</Button>
        <Button variant="outlined" startIcon={<AddBoxIcon />} onClick={() => navigate('/productos')} sx={{ minWidth: 150 }}>Producto</Button>
      </Box>
    </Box>
  )
}
