import { useState, useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  AppBar, Toolbar, Typography, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Box, Button, Collapse, Avatar,
  IconButton, Badge, Tooltip, Select, MenuItem, FormControl,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PeopleIcon from '@mui/icons-material/People'
import InventoryIcon from '@mui/icons-material/Inventory'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import ReceiptIcon from '@mui/icons-material/Receipt'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import AccountBalanceIcon from '@mui/icons-material/AccountBalance'
import HistoryIcon from '@mui/icons-material/History'
import CategoryIcon from '@mui/icons-material/Category'
import BookmarkIcon from '@mui/icons-material/Bookmark'
import SettingsIcon from '@mui/icons-material/Settings'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet'
import LogoutIcon from '@mui/icons-material/Logout'
import StorefrontIcon from '@mui/icons-material/Storefront'
import LocalShippingIcon from '@mui/icons-material/LocalShipping'
import RequestQuoteIcon from '@mui/icons-material/RequestQuote'
import BadgeIcon from '@mui/icons-material/Badge'
import WorkIcon from '@mui/icons-material/Work'
import LocalOfferIcon from '@mui/icons-material/LocalOffer'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import StoreIcon from '@mui/icons-material/Store'
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount'
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import MenuIcon from '@mui/icons-material/Menu'
import NotificationsIcon from '@mui/icons-material/Notifications'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import MapIcon from '@mui/icons-material/Map'
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar'
import { useAuth } from '../contexts/AuthContext'
import { useColorMode } from '../main'
import api from '../services/api'

const drawerWidth = 240

type MenuItem = { text: string; icon: React.ReactNode; path: string; adminOnly?: boolean; superadminOnly?: boolean }
type MenuGroup = { label: string; children: MenuItem[]; defaultOpen?: boolean }

const groups: MenuGroup[] = [
  {
    label: 'Operaciones',
    defaultOpen: true,
    children: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
      { text: 'Nueva Venta', icon: <PointOfSaleIcon />, path: '/ventas' },
      { text: 'Facturas', icon: <ReceiptIcon />, path: '/facturas' },
      { text: 'Caja Diaria', icon: <AccountBalanceIcon />, path: '/caja' },
      { text: 'Clientes', icon: <PeopleIcon />, path: '/clientes' },
    ],
  },
  {
    label: 'Inventario',
    defaultOpen: false,
    children: [
      { text: 'Productos', icon: <InventoryIcon />, path: '/productos' },
      { text: 'Compras', icon: <LocalShippingIcon />, path: '/compras' },
      { text: 'Autofacturas', icon: <ReceiptLongIcon />, path: '/autofacturas' },
      { text: 'Stock', icon: <WarehouseIcon />, path: '/stock' },
    ],
  },
  {
    label: 'Más',
    defaultOpen: false,
    children: [
      { text: 'Presupuestos', icon: <RequestQuoteIcon />, path: '/presupuestos' },
      { text: 'Ctas. Corrientes', icon: <AccountBalanceWalletIcon />, path: '/cuentas-corrientes' },
      { text: 'Proveedores', icon: <LocalShippingIcon />, path: '/proveedores' },
      { text: 'Promociones', icon: <LocalOfferIcon />, path: '/promociones' },
      { text: 'Reglas Descuento', icon: <AutoAwesomeIcon />, path: '/reglas-descuento' },
      { text: 'Logística', icon: <LocalShippingIcon />, path: '/logistica/notas-remision' },
      { text: 'Sucursales', icon: <StoreIcon />, path: '/sucursales' },
      { text: 'Transferencias', icon: <SwapHorizIcon />, path: '/transferencias' },
      { text: 'Vendedores', icon: <BadgeIcon />, path: '/vendedores' },
      { text: 'Historial Caja', icon: <HistoryIcon />, path: '/caja/historial' },
    ],
  },
  {
    label: 'Administración',
    defaultOpen: false,
    children: [
      { text: 'Auditoría', icon: <HistoryIcon />, path: '/auditoria', adminOnly: true },
      { text: 'Usuarios', icon: <AdminPanelSettingsIcon />, path: '/usuarios', adminOnly: true },
      { text: 'Configuración', icon: <SettingsIcon />, path: '/configuracion', adminOnly: true },
      { text: 'Panel Superadmin', icon: <SupervisorAccountIcon />, path: '/superadmin', superadminOnly: true },
    ],
  },
]

export default function Layout() {
  const { user, logout, tenants, cambiarTenant } = useAuth()
  const { mode, toggleColorMode } = useColorMode()
  const navigate = useNavigate()
  const location = useLocation()

  const esSuperadmin = Boolean(user?.es_superadmin)
  const isAdmin = user?.tipo === 'admin' || esSuperadmin
  // El superadmin no navega al POS: su único menú es el panel de control.
  const gruposVisibles: MenuGroup[] = esSuperadmin
    ? [{
        label: 'Control total',
        defaultOpen: true,
        children: groups.flatMap(g => g.children).filter(i => i.superadminOnly),
      }]
    : groups
  
  const [mobileOpen, setMobileOpen] = useState(false)
  const [cambiandoTenant, setCambiandoTenant] = useState(false)
  const [config, setConfig] = useState<any>(null)
  const [alertsCount, setAlertsCount] = useState(0)

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    gruposVisibles.forEach(g => {
      // Abrir si tiene defaultOpen=true, o si la ruta actual está en el grupo
      const hasActive = g.children.some(c => {
        if (c.path === '/') return location.pathname === '/'
        return location.pathname.startsWith(c.path)
      })
      initial[g.label] = g.defaultOpen || hasActive
    })
    return initial
  })

  useEffect(() => {
    if (esSuperadmin) return
    api.get('/empresa/configuracion/actual/').then(r => setConfig(r.data)).catch(() => {})
    api.get('/reportes/dashboard/').then(r => {
      let count = 0
      if (r.data.productos_stock_bajo > 0) count++
      // Podríamos agregar más validaciones aquí (caja sin abrir, timbrado por vencer)
      setAlertsCount(count)
    }).catch(() => {})
  }, [location.pathname, esSuperadmin]) // Recargar al navegar

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }))
  }

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    if (path.startsWith('/caja/historial')) return location.pathname.startsWith('/caja/historial')
    if (path.startsWith('/caja')) return location.pathname === '/caja'
    return location.pathname.startsWith(path)
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const handleNavigate = (path: string) => {
    navigate(path)
    setMobileOpen(false)
  }

  const handleTenantChange = async (tenantId: number) => {
    setCambiandoTenant(true)
    try {
      await cambiarTenant(tenantId)
    } catch {
      setCambiandoTenant(false)
    }
  }

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Botón principal siempre visible para operadores */}
      {!esSuperadmin && <Box sx={{ px: 2, pt: 2, pb: 1.5 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<PointOfSaleIcon />}
          onClick={() => handleNavigate('/ventas')}
          sx={{ 
            borderRadius: 2, 
            py: 1.2, 
            fontWeight: 800, 
            fontSize: '0.95rem', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            textTransform: 'none',
            letterSpacing: 0.5
          }}
        >
          Nueva Venta
        </Button>
      </Box>}

      <List sx={{ pt: 0, pb: 2, flexGrow: 1 }}>
        {gruposVisibles
          .filter(g => {
            // Ocultar grupo Admin completo si es vendedor
            if (g.label === 'Administración' && !isAdmin) return false
            return true
          })
          .map(group => {
            // Filtrar ítems según el rol del usuario.
            const visibleItems = group.children.filter(item =>
              (!item.adminOnly || isAdmin) && (!item.superadminOnly || esSuperadmin)
            )
            if (visibleItems.length === 0) return null
            const groupOpen = openGroups[group.label]
            return (
              <Box key={group.label}>
                <ListItemButton
                  onClick={() => toggleGroup(group.label)}
                  sx={{ mx: 1.5, my: 0.2, borderRadius: 1 }}
                >
                  <ListItemText
                    primary={group.label}
                    primaryTypographyProps={{ fontSize: '0.72rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.8 }}
                  />
                  {groupOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                </ListItemButton>
                <Collapse in={groupOpen} timeout="auto" unmountOnExit>
                  {visibleItems.map(item => (
                    <ListItemButton
                      key={item.path}
                      selected={isActive(item.path)}
                      onClick={() => handleNavigate(item.path)}
                      sx={{ mx: 1.5, my: 0.2, py: 0.6, borderRadius: 1 }}
                    >
                      <ListItemIcon sx={{ minWidth: 36, color: isActive(item.path) ? 'primary.main' : undefined }}>
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{
                          fontSize: '0.85rem',
                          fontWeight: isActive(item.path) ? 600 : 400,
                        }}
                      />
                    </ListItemButton>
                  ))}
                </Collapse>
              </Box>
            )
          })}
      </List>
    </Box>
  )

  const brandName = esSuperadmin ? 'FactuSYS · Control total' : config?.nombre || 'FactuSYS'

  return (
    <Box display="flex">
      <AppBar position="fixed" elevation={0} sx={{ zIndex: 1201 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' }, flexShrink: 0 }}
          >
            <MenuIcon />
          </IconButton>
          
          {config?.logo_url ? (
            <Box component="img" src={config.logo_url} alt="Logo" sx={{ height: 32, mr: 1.5, borderRadius: 1 }} />
          ) : (
            <StorefrontIcon sx={{ mr: 1.5, fontSize: 28, flexShrink: 0 }} />
          )}
          
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: 0.5, display: { xs: 'none', sm: 'block' } }}>
            {brandName}
          </Typography>
          
          <Box sx={{ flexGrow: 1, display: { xs: 'block', sm: 'none' } }} />

          {!esSuperadmin && tenants.length > 1 && (
            <FormControl size="small" disabled={cambiandoTenant} sx={{ mr: 2, minWidth: 150 }}>
              <Select
                value={user?.tenant_activo_id ?? tenants.find(t => t.activo)?.id ?? tenants[0].id}
                onChange={e => handleTenantChange(Number(e.target.value))}
                renderValue={value => tenants.find(t => t.id === Number(value))?.nombre ?? `Empresa ${value}`}
                sx={{
                  color: 'inherit',
                  fontSize: '0.85rem',
                  '& .MuiSelect-icon': { color: 'inherit' },
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.5)' },
                }}
              >
                {tenants.map(t => (
                  <MenuItem key={t.id} value={t.id} disabled={!t.activo}>
                    {t.nombre}{t.ruc ? ` — ${t.ruc}` : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          <Tooltip title="Cambiar tema">
            <IconButton color="inherit" onClick={toggleColorMode} sx={{ mr: 1 }}>
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          {!esSuperadmin && (
            <Tooltip title="Notificaciones">
              <IconButton color="inherit" sx={{ mr: 2 }} onClick={() => navigate('/')}>
                <Badge badgeContent={alertsCount} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          )}

          <Avatar sx={{ width: 32, height: 32, bgcolor: 'rgba(255,255,255,0.2)', fontSize: '0.85rem', mr: 1, flexShrink: 0 }}>
            {(user?.first_name || user?.username || 'U')[0].toUpperCase()}
          </Avatar>
          <Typography variant="body2" sx={{ mr: 2, opacity: 0.9, display: { xs: 'none', sm: 'block' } }}>
            {user?.first_name || user?.username}
          </Typography>
          
          <Button
            color="inherit"
            onClick={logout}
            size="small"
            sx={{
              opacity: 0.8,
              '&:hover': { opacity: 1 },
              minWidth: { xs: 'auto', sm: '64px' },
              flexShrink: 0
            }}
          >
            <LogoutIcon sx={{ mr: { xs: 0, sm: 0.5 } }} />
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Salir</Box>
          </Button>
        </Toolbar>
      </AppBar>

      {/* Temporary Mobile Drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          zIndex: 1300,
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>
          {config?.logo_url ? (
            <Box component="img" src={config.logo_url} alt="Logo" sx={{ height: 28, mr: 1.5, borderRadius: 1 }} />
          ) : (
            <StorefrontIcon sx={{ mr: 1.5, color: 'primary.main', fontSize: 28 }} />
          )}
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', letterSpacing: 0.5 }}>
            {brandName}
          </Typography>
        </Box>
        {drawerContent}
      </Drawer>

      {/* Permanent Desktop Drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', md: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            height: 'calc(100vh - 64px)',
            top: 64,
            overflowX: 'hidden',
            overflowY: 'auto'
          },
        }}
        open
      >
        {drawerContent}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, minHeight: '100vh', bgcolor: 'background.default', minWidth: 0, width: { md: `calc(100% - ${drawerWidth}px)` } }}>
        <Outlet />
      </Box>
    </Box>
  )
}

