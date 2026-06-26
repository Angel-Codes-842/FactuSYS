# Fase 2 — Notas de Crédito/Débito Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add UI para crear y visualizar Notas de Crédito/Débito sobre el backend existente de Factura.

**Architecture:** No new models. Backend already has `tipo_nota`, `factura_origen`, `motivo_nota` in Factura model, `NotaCreditoDebitoSerializer`, and `nota_credito` action in FacturaViewSet. Only need Frontend UI + minor backend tweaks.

**Tech Stack:** Django 6, DRF, React 19, MUI 6.

---

## File Structure

```
frontend/src/pages/FacturasPage.tsx         ← MODIFY: add NC/ND actions + columns
frontend/src/components/SharedComponents.tsx  ← MODIFY: add NotaCreditoDebitoDialog
backend/apps/facturacion/views.py             ← MODIFY: rename action to nota + add sucursal FK copy
backend/apps/facturacion/serializers.py       ← MODIFY: add descuento fields to NotaCreditoDebitoSerializer
```

---

### Task 1: Rename/expand nota_credito action + serializer

**Files:**
- Modify: `backend/apps/facturacion/views.py`
- Modify: `backend/apps/facturacion/serializers.py`

- [ ] **Step 1: Rename action from `nota_credito` to `crear_nota` (more generic)**

In `facturacion/views.py`, change:
```python
    @action(detail=True, methods=['post'])
    def nota_credito(self, request, pk=None):
```
to:
```python
    @action(detail=True, methods=['post'], url_path='crear-nota')
    def crear_nota(self, request, pk=None):
```

Update the response to include `factura_origen_id` and copy sucursal from origen:
```python
        nota = Factura(
            tipo=factura.tipo,
            tipo_nota=serializer.validated_data['tipo_nota'],
            factura_origen=factura,
            motivo_nota=serializer.validated_data.get('motivo_nota', ''),
            cliente=factura.cliente,
            usuario=request.user,
            sucursal=factura.sucursal,
        )
```

- [ ] **Step 2: Django check migration**

No new migration needed — fields already exist. Just verify:
Run: `docker compose exec backend python manage.py check`
Expected: OK

---

### Task 2: Frontend — FacturasPage NC/ND UI

**Files:**
- Modify: `frontend/src/pages/FacturasPage.tsx`
- Optionally create: `frontend/src/components/NotaCreditoDialog.tsx`

- [ ] **Step 1: Add NC/ND column in table**

After the `Tipo` column, add:
```typescript
<TableCell align="center">Nota</TableCell>
```

In row, add cell:
```typescript
<TableCell align="center">
  {f.tipo_nota ? (
    <Chip label={f.tipo_nota === 'credito' ? 'NC' : 'ND'} size="small"
      color={f.tipo_nota === 'credito' ? 'info' : 'warning'} />
  ) : f.factura_origen ? (
    <Chip label="Nota" size="small" color="default" />
  ) : <Typography variant="body2" color="text.disabled">—</Typography>}
</TableCell>
```

- [ ] **Step 2: Add "Crear NC/ND" button in detail dialog**

After the "Imprimir" button in detail dialog actions:
```typescript
<Button onClick={() => { setNotaDialogOpen(detailOpen); setDetailOpen(null) }}
  startIcon={<NoteAddIcon />} color="secondary">
  NC / ND
</Button>
```

Add import: `import NoteAddIcon from '@mui/icons-material/NoteAdd'`

- [ ] **Step 3: Create NotaCreditoDebito dialog component**

Create a new component or inline dialog in FacturasPage that:
1. Selector: tipo (Crédito / Débito) — RadioGroup
2. Motivo: TextField multiline
3. Detalles: same sub-table as ventas (Autocomplete producto + cantidad) — prefilled from factura original
4. Botón "Emitir Nota"

```tsx
// Inside FacturasPage, add state:
const [notaTarget, setNotaTarget] = useState<any>(null)
const [notaForm, setNotaForm] = useState({ tipo_nota: 'credito', motivo: '', detalles: [] as any[] })

// Add handler:
const handleCrearNota = async () => {
  await api.post(`/facturacion/facturas/${notaTarget.id}/crear-nota/`, notaForm)
  setNotaTarget(null)
  setNotaForm({ tipo_nota: 'credito', motivo: '', detalles: [] })
  load()
  setSnack('Nota creada')
}

// Add dialog JSX (append after detail dialog):
<Dialog open={!!notaTarget} onClose={() => setNotaTarget(null)} maxWidth="md" fullWidth>
  <DialogTitle>Nueva Nota — {notaTarget?.numero}</DialogTitle>
  <DialogContent>
    <FormControl fullWidth margin="dense">
      <InputLabel>Tipo de nota</InputLabel>
      <Select value={notaForm.tipo_nota}
        onChange={e => setNotaForm({...notaForm, tipo_nota: e.target.value})} label="Tipo de nota">
        <MenuItem value="credito">Nota de Crédito</MenuItem>
        <MenuItem value="debito">Nota de Débito</MenuItem>
      </Select>
    </FormControl>
    <TextField label="Motivo" multiline rows={2} fullWidth margin="dense"
      value={notaForm.motivo}
      onChange={e => setNotaForm({...notaForm, motivo: e.target.value})} />
    <Typography variant="subtitle2" mt={2} mb={1}>Detalles</Typography>
    {notaForm.detalles.map((d, i) => (
      <Box key={i} display="flex" gap={1} mb={1}>
        <Typography flex={1}>{d.producto_nombre}</Typography>
        <Typography sx={{ width: 80 }}>x{d.cantidad}</Typography>
        <Typography sx={{ width: 120 }}>Gs. {Number(d.precio_unitario).toLocaleString('es-PY')}</Typography>
      </Box>
    ))}
    <Button size="small" onClick={() => setNotaForm({
      ...notaForm,
      detalles: [...notaForm.detalles, { producto: '', producto_nombre: '', cantidad: 1, precio_unitario: 0 }]
    })}>+ Agregar producto</Button>
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setNotaTarget(null)} color="inherit">Cancelar</Button>
    <Button variant="contained" onClick={handleCrearNota} color={notaForm.tipo_nota === 'credito' ? 'info' : 'warning'}>
      Emitir {notaForm.tipo_nota === 'credito' ? 'Nota de Crédito' : 'Nota de Débito'}
    </Button>
  </DialogActions>
</Dialog>
```

- [ ] **Step 4: Add factura_origen_numero in detail dialog**

In the detail dialog, show the origin factura link when viewing a nota:
```typescript
{detailOpen.factura_origen && (
  <Box gridColumn="span 2">
    <Typography variant="caption" color="text.secondary">Factura origen</Typography>
    <Button size="small" onClick={() => {
      // could navigate or fetch
    }}>{detailOpen.factura_origen_numero}</Button>
  </Box>
)}
```

- [ ] **Step 5: Verify build**

Run: `npx --no-install vite build` (from `frontend/`)
Expected: `✓ built in X.XXs`
