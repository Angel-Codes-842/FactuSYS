import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  AppBar, Toolbar, Typography, Drawer, List, ListItemButton,
  ListItemIcon, ListItemText, Box, Button, Collapse, Avatar,
  IconButton,
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import PeopleIcon from '@mui/icons-material/People'
import InventoryIcon from '@mui/icons-material/Inventory'
import WarehouseIcon from '@mui/icons-material/Warehouse'
import PointOfSaleIcon from '@mui/icons-material/PointOfSale'
import ReceiptIcon from '@mui/icons-material/Receipt'
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
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import MenuIcon from '@mui/icons-material/Menu'
import { useAuth } from '../contexts/AuthContext'

const drawerWidth = 240

type MenuGroup = {
  label: string
  children: { text: string; icon: React.ReactNode; path: string }[]
}

const groups: MenuGroup[] = [
  {
    label: 'General',
    children: [
      { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
    ],
  },
  {
    label: 'Ventas',
    children: [
      { text: 'Presupuestos', icon: <RequestQuoteIcon />, path: '/presupuestos' },
      { text: 'Ventas', icon: <PointOfSaleIcon />, path: '/ventas' },
      { text: 'Facturas', icon: <ReceiptIcon />, path: '/facturas' },
      { text: 'Caja Diaria', icon: <AccountBalanceIcon />, path: '/caja' },
      { text: 'Historial Caja', icon: <HistoryIcon />, path: '/caja/historial' },
      { text: 'Promociones', icon: <LocalOfferIcon />, path: '/promociones' },
      { text: 'Reglas Descuento', icon: <AutoAwesomeIcon />, path: '/reglas-descuento' },
    ],
  },
  {
    label: 'Inventario',
    children: [
      { text: 'Productos', icon: <InventoryIcon />, path: '/productos' },
      { text: 'Compras', icon: <LocalShippingIcon />, path: '/compras' },
      { text: 'Stock', icon: <WarehouseIcon />, path: '/stock' },
      { text: 'Categorías', icon: <CategoryIcon />, path: '/categoria' },
      { text: 'Marcas', icon: <BookmarkIcon />, path: '/productos/marcas' },
    ],
  },
  {
    label: 'Logística',
    children: [
      { text: 'Notas de Remisión', icon: <LocalShippingIcon />, path: '/logistica/notas-remision' },
      { text: 'Transportistas', icon: <LocalShippingIcon />, path: '/logistica/transportistas' },
      { text: 'Zonas', icon: <LocalShippingIcon />, path: '/logistica/zonas' },
      { text: 'Sucursales', icon: <StoreIcon />, path: '/sucursales' },
      { text: 'Transferencias', icon: <SwapHorizIcon />, path: '/transferencias' },
    ],
  },
  {
    label: 'Clientes',
    children: [
      { text: 'Clientes', icon: <PeopleIcon />, path: '/clientes' },
      { text: 'Proveedores', icon: <LocalShippingIcon />, path: '/proveedores' },
      { text: 'Ctas. Corrientes', icon: <AccountBalanceWalletIcon />, path: '/cuentas-corrientes' },
    ],
  },
  {
    label: 'RRHH',
    children: [
      { text: 'Vendedores', icon: <BadgeIcon />, path: '/vendedores' },
      { text: 'Puestos', icon: <WorkIcon />, path: '/puestos' },
    ],
  },
  {
    label: 'Administración',
    children: [
      { text: 'Usuarios', icon: <AdminPanelSettingsIcon />, path: '/usuarios' },
      { text: 'Configuración', icon: <SettingsIcon />, path: '/configuracion' },
    ],
  },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    groups.forEach(g => {
      initial[g.label] = g.children.some(c => {
        if (c.path === '/') return location.pathname === '/'
        return location.pathname.startsWith(c.path)
      })
    })
    return initial
  })

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

  const drawerContent = (
    <List sx={{ pt: 1.5, pb: 2 }}>
      {groups.map(group => {
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
              {group.children.map(item => (
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
  )

  return (
    <Box display="flex">
      <AppBar position="fixed" elevation={0} sx={{ zIndex: 1201, borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
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
          <StorefrontIcon sx={{ mr: 1.5, fontSize: 28, flexShrink: 0 }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 700, letterSpacing: 0.5, display: { xs: 'none', sm: 'block' } }}>
            FactuSYS
          </Typography>
          <Box sx={{ flexGrow: 1, display: { xs: 'block', sm: 'none' } }} />
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
        ModalProps={{
          keepMounted: true,
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          zIndex: 1300,
        }}
      >
        <Box sx={{ p: 2, display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.12)' }}>
          <StorefrontIcon sx={{ mr: 1.5, color: 'primary.main', fontSize: 28 }} />
          <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main', letterSpacing: 0.5 }}>
            FactuSYS
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
