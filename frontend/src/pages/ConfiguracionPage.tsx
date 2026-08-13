import { useState, useEffect } from 'react'
import {
  Box, Typography, Card, CardContent, TextField, Button,
  FormControl, InputLabel, Select, MenuItem,
  Snackbar, Alert, Grid2, CircularProgress, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Tabs, Tab
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import StorefrontIcon from '@mui/icons-material/Storefront'
import PrintIcon from '@mui/icons-material/Print'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import api from '../services/api'
import { useEmpresaConfig, useTimbrados, useTimbradosAutofactura, useActualizarEmpresaConfig, useCrearTimbrado, useActualizarTimbrado, useEliminarTimbrado } from '../hooks/useApi'

function TimbradoTable({ rows, onEdit, onDelete }: { rows: any[], onEdit: (t: any) => void, onDelete: (id: number) => void }) {
  return (
    <TableContainer sx={{ overflowX: 'auto', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Nº Timbrado</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Vigencia</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Rango</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Usados</TableCell>
            <TableCell align="center" sx={{ fontWeight: 700 }}>Estado</TableCell>
            <TableCell align="right" sx={{ fontWeight: 700 }}>Acciones</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((t: any) => (
            <TableRow key={t.id} hover>
              <TableCell sx={{ fontWeight: 600 }}>{t.numero}</TableCell>
              <TableCell>
                {new Date(t.fecha_inicio).toLocaleDateString('es-PY')}
                {' — '}
                {new Date(t.fecha_fin).toLocaleDateString('es-PY')}
              </TableCell>
              <TableCell>{t.rango_inicio} — {t.rango_fin}</TableCell>
              <TableCell>{t.numero_actual}</TableCell>
              <TableCell align="center">
                <Chip size="small"
                  label={t.vigente ? 'Vigente' : t.activo ? 'Inactivo' : 'Vencido'}
                  color={t.vigente ? 'success' : 'default'}
                />
              </TableCell>
              <TableCell align="right">
                <IconButton size="small" onClick={() => onEdit(t)}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton size="small" color="error" onClick={() => onDelete(t.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}


export default function ConfiguracionPage() {
  const { data: empresaConfig, isLoading } = useEmpresaConfig()
  const { data: timbrados } = useTimbrados()
  const { data: timbradosAF } = useTimbradosAutofactura()
  const guardarConfig = useActualizarEmpresaConfig()
  const crearTimbrado = useCrearTimbrado()
  const actualizarTimbrado = useActualizarTimbrado()
  const eliminarTimbrado = useEliminarTimbrado()
  const [saving, setSaving] = useState(false)
  const [configId, setConfigId] = useState<number | null>(null)
  
  const [form, setForm] = useState<any>({
    nombre: '', ruc: '', direccion: '', telefono: '', ciudad: '', rubro: 'general',
    formato_impresion: 'a4', timbrado_activo: '', pie_factura: '',
    logo: null,
  })

  const [timbradosTab, setTimbradosTab] = useState(0)
  const [snack, setSnack] = useState('')
  
  const [timbradoDialog, setTimbradoDialog] = useState(false)
  const [timbradoEdit, setTimbradoEdit] = useState<any>(null)
  const [timbradoTipo, setTimbradoTipo] = useState<'factura' | 'autofactura'>('factura')
  const [timbradoForm, setTimbradoForm] = useState({
    numero: '', fecha_inicio: '', fecha_fin: '',
    rango_inicio: '', rango_fin: '', activo: true,
  })

  useEffect(() => {
    if (empresaConfig?.id) {
      setConfigId(empresaConfig.id)
      setForm({
        nombre: empresaConfig.nombre || '',
        ruc: empresaConfig.ruc || '',
        direccion: empresaConfig.direccion || '',
        telefono: empresaConfig.telefono || '',
        ciudad: empresaConfig.ciudad || '',
        rubro: empresaConfig.rubro || 'general',
        formato_impresion: empresaConfig.formato_impresion || 'a4',
        timbrado_activo: empresaConfig.timbrado_activo || '',
        pie_factura: empresaConfig.pie_factura || '',
        logo: null,
      })
    }
  }, [empresaConfig])

  const handleSave = async () => {
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]: [string, any]) => {
        if (k === 'logo') {
          if (v) fd.append(k, v as Blob)
        } else if (k === 'timbrado_activo' && !v) {
        } else {
          fd.append(k, String(v))
        }
      })
      await guardarConfig.mutateAsync({ id: configId ?? undefined, data: fd })
      setSnack('Configuración guardada. Refresque para ver cambios en el menú.')
    } catch (e: any) {
      setSnack(e?.response?.data ? `Error: ${JSON.stringify(e.response.data)}` : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const openTimbradoDialog = (t?: any) => {
    if (t) {
      setTimbradoEdit(t)
      setTimbradoForm({
        numero: t.numero, fecha_inicio: t.fecha_inicio, fecha_fin: t.fecha_fin,
        rango_inicio: String(t.rango_inicio), rango_fin: String(t.rango_fin), activo: t.activo,
      })
    } else {
      setTimbradoEdit(null)
      setTimbradoForm({ numero: '', fecha_inicio: '', fecha_fin: '', rango_inicio: '', rango_fin: '', activo: true })
    }
    setTimbradoDialog(true)
  }

  const openTimbradoDialogAF = (t?: any) => {
    setTimbradoTipo('autofactura')
    if (t) {
      setTimbradoEdit(t)
      setTimbradoForm({
        numero: t.numero, fecha_inicio: t.fecha_inicio, fecha_fin: t.fecha_fin,
        rango_inicio: String(t.rango_inicio), rango_fin: String(t.rango_fin), activo: t.activo,
      })
    } else {
      setTimbradoEdit(null)
      setTimbradoForm({ numero: '', fecha_inicio: '', fecha_fin: '', rango_inicio: '', rango_fin: '', activo: true })
    }
    setTimbradoDialog(true)
  }

  const handleGuardarTimbrado = async () => {
    try {
      const payload = { ...timbradoForm, rango_inicio: Number(timbradoForm.rango_inicio), rango_fin: Number(timbradoForm.rango_fin) }
      const tipo: 'normal' | 'autofactura' = timbradoTipo === 'autofactura' ? 'autofactura' : 'normal'
      if (timbradoEdit) {
        await actualizarTimbrado.mutateAsync({ tipo, id: timbradoEdit.id, data: payload })
      } else {
        await crearTimbrado.mutateAsync({ tipo, data: payload })
      }
      setTimbradoDialog(false)
      setSnack(timbradoEdit ? 'Timbrado actualizado' : 'Timbrado creado')
    } catch (e: any) {
      setSnack(e?.response?.data ? `Error: ${JSON.stringify(e.response.data)}` : 'Error al guardar timbrado')
    }
  }

  const handleEliminarTimbrado = async (id: number, tipo: 'factura' | 'autofactura' = 'factura') => {
    try {
      await eliminarTimbrado.mutateAsync({ tipo: tipo === 'autofactura' ? 'autofactura' : 'normal', id })
      if (tipo === 'factura' && form.timbrado_activo === id) setForm((prev: any) => ({ ...prev, timbrado_activo: '' }))
      setSnack('Timbrado eliminado')
    } catch {
      setSnack('Error al eliminar timbrado')
    }
  }

  if (isLoading) return <Box display="flex" justifyContent="center" py={8}><CircularProgress /></Box>

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <SettingsIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Configuración Global
        </Typography>
        <Button variant="contained" onClick={handleSave} disabled={saving} size="large">
          {saving ? 'Guardando...' : 'Guardar Cambios'}
        </Button>
      </Box>

      <Grid2 container spacing={3}>
        <Grid2 size={{ xs: 12, md: 8 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" mb={2} display="flex" alignItems="center">
                <StorefrontIcon sx={{ mr: 1 }} color="primary" /> Perfil del Negocio
              </Typography>
              <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={2}>
                <TextField label="Nombre de la empresa / Razón Social" value={form.nombre}
                  onChange={e => setForm({...form, nombre: e.target.value})} sx={{ gridColumn: '1 / -1' }} />
                <TextField label="RUC" value={form.ruc}
                  onChange={e => setForm({...form, ruc: e.target.value})} />
                <FormControl>
                  <InputLabel>Rubro / Giro Comercial</InputLabel>
                  <Select value={form.rubro} label="Rubro / Giro Comercial"
                    onChange={e => setForm({...form, rubro: e.target.value})}>
                    <MenuItem value="general">General / Otro</MenuItem>
                    <MenuItem value="autoservicio">Autoservicio / Minimarket</MenuItem>
                    <MenuItem value="fruteria">Frutería / Verdulería</MenuItem>
                    <MenuItem value="ferreteria">Ferretería</MenuItem>
                    <MenuItem value="farmacia">Farmacia</MenuItem>
                    <MenuItem value="restaurante">Restaurante / Bar</MenuItem>
                    <MenuItem value="ropa">Indumentaria / Ropa</MenuItem>
                    <MenuItem value="electronica">Electrónica / Tecnología</MenuItem>
                    <MenuItem value="servicio">Prestación de Servicios</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="Ciudad" value={form.ciudad}
                  onChange={e => setForm({...form, ciudad: e.target.value})} />
                <TextField label="Teléfono" value={form.telefono}
                  onChange={e => setForm({...form, telefono: e.target.value})} />
                <TextField label="Dirección" value={form.direccion}
                  onChange={e => setForm({...form, direccion: e.target.value})}
                  sx={{ gridColumn: '1 / -1' }} />
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2} flexWrap="wrap" gap={1}>
                <Typography variant="h6">Timbrados</Typography>
                <Button
                  size="small" variant="contained" startIcon={<AddIcon />}
                  onClick={() => {
                    if (timbradosTab === 0) { setTimbradoTipo('factura'); openTimbradoDialog() }
                    else openTimbradoDialogAF()
                  }}
                >
                  {timbradosTab === 0 ? 'Nuevo Timbrado Factura' : 'Nuevo Timbrado Autofactura'}
                </Button>
              </Box>

              <Tabs value={timbradosTab} onChange={(_, v) => setTimbradosTab(v)} sx={{ mb: 2 }}>
                <Tab label="Facturas" />
                <Tab label={<Box display="flex" alignItems="center" gap={0.5}><ReceiptLongIcon fontSize="small" />Autofacturas</Box>} />
              </Tabs>

              {timbradosTab === 0 && (
                !timbrados ? <Box textAlign="center" py={4}><CircularProgress /></Box> : timbrados.length === 0 ? (
                  <Alert severity="warning">No hay timbrados de factura. Creá uno para emitir facturas legales.</Alert>
                ) : (
                  <TimbradoTable rows={timbrados} onEdit={(t) => { setTimbradoTipo('factura'); openTimbradoDialog(t) }} onDelete={(id) => handleEliminarTimbrado(id, 'factura')} />
                )
              )}

              {timbradosTab === 1 && (
                !timbradosAF ? <Box textAlign="center" py={4}><CircularProgress /></Box> : timbradosAF.length === 0 ? (
                  <Alert severity="warning">No hay timbrados de autofactura. Creá uno para emitir autofacturas.</Alert>
                ) : (
                  <TimbradoTable rows={timbradosAF} onEdit={(t) => openTimbradoDialogAF(t)} onDelete={(id) => handleEliminarTimbrado(id, 'autofactura')} />
                )
              )}
            </CardContent>
          </Card>
        </Grid2>

        <Grid2 size={{ xs: 12, md: 4 }}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" mb={2}>Identidad Visual</Typography>
              
              <Box mb={2} textAlign="center" p={2} sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
                 {(form.logo || empresaConfig?.logo_url) ? (
                    <Box 
                      component="img" 
                      src={form.logo ? URL.createObjectURL(form.logo) : empresaConfig?.logo_url} 
                      sx={{ maxHeight: 120, maxWidth: '100%', objectFit: 'contain' }}
                    />
                 ) : (
                    <Typography color="text.secondary" variant="body2" py={3}>Sin logo configurado</Typography>
                 )}
              </Box>

              <Button variant="outlined" component="label" fullWidth>
                {form.logo ? 'Cambiar imagen...' : 'Seleccionar logo...'}
                <input type="file" hidden accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) setForm({...form, logo: file})
                  }} />
              </Button>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" mb={2} display="flex" alignItems="center">
                <PrintIcon sx={{ mr: 1 }} color="primary" /> Preferencias de Impresión
              </Typography>
              
              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Formato por defecto</InputLabel>
                <Select value={form.formato_impresion} label="Formato por defecto"
                  onChange={e => setForm({...form, formato_impresion: e.target.value})}>
                  <MenuItem value="a4">A4 (Impresora Estándar)</MenuItem>
                  <MenuItem value="ticket80">Ticket 80mm (Térmica)</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Timbrado para facturación (Defecto)</InputLabel>
                <Select value={form.timbrado_activo}
                  onChange={e => setForm({...form, timbrado_activo: e.target.value})} label="Timbrado para facturación (Defecto)">
                  <MenuItem value="">-- Ninguno (No requiere) --</MenuItem>
                  {(timbrados ?? []).filter((t: any) => t.vigente).map((t: any) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.numero} (Activo)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField label="Texto al pie de la factura" multiline rows={3} fullWidth
                value={form.pie_factura}
                placeholder="¡Gracias por su preferencia!"
                onChange={e => setForm({...form, pie_factura: e.target.value})} />
            </CardContent>
          </Card>
        </Grid2>
      </Grid2>

      <Dialog open={timbradoDialog} onClose={() => setTimbradoDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{timbradoEdit ? 'Editar Timbrado' : 'Nuevo Timbrado'}</DialogTitle>
        <DialogContent>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2} pt={1}>
            <TextField label="Nº Timbrado SET" value={timbradoForm.numero}
              onChange={e => setTimbradoForm({...timbradoForm, numero: e.target.value})} fullWidth />
            <FormControl fullWidth>
              <InputLabel>Activo</InputLabel>
              <Select value={timbradoForm.activo ? 'si' : 'no'}
                onChange={e => setTimbradoForm({...timbradoForm, activo: e.target.value === 'si'})} label="Activo" fullWidth>
                <MenuItem value="si">Sí</MenuItem>
                <MenuItem value="no">No</MenuItem>
              </Select>
            </FormControl>
            <TextField label="Fecha inicio" type="date" value={timbradoForm.fecha_inicio}
              onChange={e => setTimbradoForm({...timbradoForm, fecha_inicio: e.target.value})}
              slotProps={{ inputLabel: { shrink: true } }} fullWidth />
            <TextField label="Fecha vencimiento" type="date" value={timbradoForm.fecha_fin}
              onChange={e => setTimbradoForm({...timbradoForm, fecha_fin: e.target.value})}
              slotProps={{ inputLabel: { shrink: true } }} fullWidth />
            <TextField label="Rango inicio" type="number" value={timbradoForm.rango_inicio}
              onChange={e => setTimbradoForm({...timbradoForm, rango_inicio: e.target.value})} fullWidth />
            <TextField label="Rango fin" type="number" value={timbradoForm.rango_fin}
              onChange={e => setTimbradoForm({...timbradoForm, rango_fin: e.target.value})} fullWidth />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTimbradoDialog(false)} color="inherit">Cancelar</Button>
          <Button variant="contained" onClick={handleGuardarTimbrado}>
            {timbradoEdit ? 'Guardar cambios' : 'Crear Timbrado'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!snack} autoHideDuration={4000} onClose={() => setSnack('')}>
        <Alert severity={snack.includes('Error') ? 'error' : 'success'} onClose={() => setSnack('')}>
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  )
}
