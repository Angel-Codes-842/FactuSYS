import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Layout from './components/Layout'
import ClientesPage from './pages/ClientesPage'
import ProveedoresPage from './pages/ProveedoresPage'
import ProductosPage from './pages/ProductosPage'
import FacturasPage from './pages/FacturasPage'
import StockPage from './pages/StockPage'
import CajaPage from './pages/CajaPage'
import ComprasPage from './pages/ComprasPage'
import PresupuestosPage from './pages/PresupuestosPage'
import CajaHistorialPage from './pages/CajaHistorialPage'
import CategoriasPage from './pages/CategoriasPage'
import MarcasPage from './pages/MarcasPage'
import VentasPage from './pages/VentasPage'
import ConfiguracionPage from './pages/ConfiguracionPage'
import AuditoriaPage from './pages/AuditoriaPage'
import UsuariosPage from './pages/UsuariosPage'
import CuentasCorrientesPage from './pages/CuentasCorrientesPage'
import VendedoresPage from './pages/VendedoresPage'
import PuestosPage from './pages/PuestosPage'
import PromocionesPage from './pages/PromocionesPage'
import ReglasDescuentoPage from './pages/ReglasDescuentoPage'
import SucursalesPage from './pages/SucursalesPage'
import TransferenciasPage from './pages/TransferenciasPage'
import TransportistasPage from './pages/TransportistasPage'
import ZonasPage from './pages/ZonasPage'
import NotasRemisionPage from './pages/NotasRemisionPage'
import AutofacturasPage from './pages/AutofacturasPage'
import ResetPassword from './pages/ResetPassword'
import ResetPasswordConfirm from './pages/ResetPasswordConfirm'
import { CircularProgress, Box } from '@mui/material'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <Box display="flex" justifyContent="center" mt={10}><CircularProgress /></Box>
  return user ? <>{children}</> : <Navigate to="/login" />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/reset-password/:uid/:token" element={<ResetPasswordConfirm />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="proveedores" element={<ProveedoresPage />} />
        <Route path="productos" element={<ProductosPage />} />
        <Route path="stock" element={<StockPage />} />
        <Route path="ventas" element={<VentasPage />} />
        <Route path="facturas" element={<FacturasPage />} />
        <Route path="categoria" element={<CategoriasPage />} />
        <Route path="productos/marcas" element={<MarcasPage />} />
        <Route path="caja" element={<CajaPage />} />
        <Route path="compras" element={<ComprasPage />} />
        <Route path="presupuestos" element={<PresupuestosPage />} />
        <Route path="caja/historial" element={<CajaHistorialPage />} />
        <Route path="configuracion" element={<ConfiguracionPage />} />
        <Route path="auditoria" element={<AuditoriaPage />} />
        <Route path="usuarios" element={<UsuariosPage />} />
        <Route path="cuentas-corrientes" element={<CuentasCorrientesPage />} />
        <Route path="vendedores" element={<VendedoresPage />} />
        <Route path="puestos" element={<PuestosPage />} />
        <Route path="promociones" element={<PromocionesPage />} />
        <Route path="reglas-descuento" element={<ReglasDescuentoPage />} />
        <Route path="sucursales" element={<SucursalesPage />} />
        <Route path="transferencias" element={<TransferenciasPage />} />
        <Route path="logistica/transportistas" element={<TransportistasPage />} />
        <Route path="logistica/zonas" element={<ZonasPage />} />
        <Route path="logistica/notas-remision" element={<NotasRemisionPage />} />
        <Route path="autofacturas" element={<AutofacturasPage />} />
      </Route>
    </Routes>
  )
}
