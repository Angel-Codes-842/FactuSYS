import { useState, useEffect } from 'react'
import {
  Box, Typography, Card, CardContent, TextField, Button,
  FormControl, InputLabel, Select, MenuItem,
  Snackbar, Alert, Grid2, CircularProgress, Chip, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import api from '../services/api'

export default function ConfiguracionPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<any>({
    nombre: '', ruc: '', direccion: '', telefono: '', ciudad: '',
    timbrado_activo: '', pie_factura: '', logo: null,
  })
  const [timbrados, setTimbrados] = useState<any[]>([])
  const [snack, setSnack] = useState('')
  const [configId, setConfigId] = useState<number | null>(null)
  const [timbradoDialog, setTimbradoDialog] = useState(false)
  const [timbradoEdit, setTimbradoEdit] = useState<any>(null)
  const [timbradoForm, setTimbradoForm] = useState({
    numero: '', fecha_inicio: '', fecha_fin: '',
    rango_inicio: '', rango_fin: '', activo: true,
  })

  useEffect(() => {
    Promise.all([
      api.get('/empresa/configuracion/actual/'),
      api.get('/facturacion/timbrados/'),
    ]).then(([r1, r2]) => {
      const c = r1.data
      if (c && c.id) {
        setConfigId(c.id)
        setForm({
          nombre: c.nombre || '',
          ruc: c.ruc || '',
          direccion: c.direccion || '',
          telefono: c.telefono || '',
          ciudad: c.ciudad || '',
          timbrado_activo: c.timbrado_activo || '',
          pie_factura: c.pie_factura || '',
          logo: null,
        })
      }
      setTimbrados(r2.data.results || r2.data)
    }).catch(() => setSnack('Error al cargar configuración'))
    .finally(() => setLoading(false))
  }, [])

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
      if (configId) {
        await api.patch(`/empresa/configuracion/${configId}/`, fd)
      } else {
        await api.post('/empresa/configuracion/', fd)
      }
      setSnack('Configuración guardada')
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
        numero: t.numero,
        fecha_inicio: t.fecha_inicio,
        fecha_fin: t.fecha_fin,
        rango_inicio: String(t.rango_inicio),
        rango_fin: String(t.rango_fin),
        activo: t.activo,
      })
    } else {
      setTimbradoEdit(null)
      setTimbradoForm({ numero: '', fecha_inicio: '', fecha_fin: '', rango_inicio: '', rango_fin: '', activo: true })
    }
    setTimbradoDialog(true)
  }

  const handleGuardarTimbrado = async () => {
    try {
      const payload = {
        ...timbradoForm,
        rango_inicio: Number(timbradoForm.rango_inicio),
        rango_fin: Number(timbradoForm.rango_fin),
      }
      if (timbradoEdit) {
        await api.patch(`/facturacion/timbrados/${timbradoEdit.id}/`, payload)
      } else {
        await api.post('/facturacion/timbrados/', payload)
      }
      setTimbradoDialog(false)
      const r = await api.get('/facturacion/timbrados/')
      setTimbrados(r.data.results || r.data)
      setSnack(timbradoEdit ? 'Timbrado actualizado' : 'Timbrado creado')
    } catch (e: any) {
      setSnack(e?.response?.data ? `Error: ${JSON.stringify(e.response.data)}` : 'Error al guardar timbrado')
    }
  }

  const handleEliminarTimbrado = async (id: number) => {
    try {
      await api.delete(`/facturacion/timbrados/${id}/`)
      const r = await api.get('/facturacion/timbrados/')
      setTimbrados(r.data.results || r.data)
      if (form.timbrado_activo === id) {
        setForm((prev: any) => ({ ...prev, timbrado_activo: '' }))
      }
      setSnack('Timbrado eliminado')
    } catch {
      setSnack('Error al eliminar timbrado')
    }
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={3}>
        <Typography variant="h4" fontWeight="bold">
          <SettingsIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
          Configuración
        </Typography>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </Button>
      </Box>

      <Grid2 container spacing={3}>
        <Grid2 size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>Datos de la Empresa</Typography>
              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
                <TextField label="Nombre de la empresa" value={form.nombre}
                  onChange={e => setForm({...form, nombre: e.target.value})} />
                <TextField label="RUC" value={form.ruc}
                  onChange={e => setForm({...form, ruc: e.target.value})} />
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

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Typography variant="h6" mb={2}>Timbrado SET</Typography>
              <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
                <FormControl>
                  <InputLabel>Timbrado activo</InputLabel>
                  <Select value={form.timbrado_activo}
                    onChange={e => setForm({...form, timbrado_activo: e.target.value})} label="Timbrado activo">
                    <MenuItem value="">Sin timbrado</MenuItem>
                    {timbrados.map((t: any) => (
                      <MenuItem key={t.id} value={t.id}>
                        {t.numero} — vence {new Date(t.fecha_fin).toLocaleDateString('es-PY')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              <TextField label="Texto pie de factura" multiline rows={2} fullWidth sx={{ mt: 2 }}
                value={form.pie_factura}
                onChange={e => setForm({...form, pie_factura: e.target.value})} />
            </CardContent>
          </Card>

          <Card sx={{ mt: 3 }}>
            <CardContent>
              <Box display="flex" flexDirection={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={2}>
                <Typography variant="h6">Timbrados registrados</Typography>
                <Button size="small" variant="contained" startIcon={<AddIcon />}
                  onClick={() => openTimbradoDialog()}>
                  Nuevo
                </Button>
              </Box>
              {timbrados.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  No hay timbrados registrados. Creá uno para empezar a facturar.
                </Typography>
              ) : (
                <TableContainer sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Nº Timbrado</TableCell>
                        <TableCell>Vigencia</TableCell>
                        <TableCell>Rango</TableCell>
                        <TableCell>Usados</TableCell>
                        <TableCell align="center">Estado</TableCell>
                        <TableCell align="right">Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {timbrados.map((t: any) => (
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
                            <IconButton size="small" onClick={() => openTimbradoDialog(t)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" color="error" onClick={() => handleEliminarTimbrado(t.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
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
          <Card>
            <CardContent>
              <Typography variant="h6" mb={2}>Logo</Typography>
              <Button variant="outlined" component="label" fullWidth>
                {form.logo ? form.logo.name : 'Seleccionar archivo'}
                <input type="file" hidden accept="image/*"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) setForm({...form, logo: file})
                  }} />
              </Button>
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

      <Snackbar open={!!snack} autoHideDuration={3000} onClose={() => setSnack('')}>
        <Alert severity={snack.includes('Error') ? 'error' : 'success'} onClose={() => setSnack('')}>
          {snack}
        </Alert>
      </Snackbar>
    </Box>
  )
}
