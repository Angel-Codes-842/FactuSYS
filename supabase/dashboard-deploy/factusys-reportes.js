// supabase/functions/factusys-reportes/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.119.2";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

// supabase/functions/_shared/cors.ts
var corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// supabase/functions/_shared/keys.ts
function leerKeys(nombre) {
  const crudo = Deno.env.get(nombre);
  if (!crudo) return {};
  try {
    const parsed = JSON.parse(crudo);
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, valor]) => typeof valor === "string")
    );
  } catch {
    return {};
  }
}
function publishableKey() {
  return leerKeys("SUPABASE_PUBLISHABLE_KEYS")["default"] ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

// supabase/functions/factusys-reportes/index.ts
var HttpError = class extends Error {
  status;
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
};
function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
function env(clave) {
  const valor = Deno.env.get(clave);
  if (!valor) throw new HttpError(`Falta ${clave} en la configuraci\xF3n de la funci\xF3n`, 500);
  return valor;
}
function esc(valor) {
  return String(valor ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}
function fmt(valor) {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) ? new Intl.NumberFormat("es-PY", { maximumFractionDigits: 0 }).format(numero) : "0";
}
function fecha(valor, conHora = false) {
  if (!valor) return "\u2014";
  const d = new Date(String(valor));
  if (Number.isNaN(d.getTime())) return String(valor);
  return new Intl.DateTimeFormat("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...conHora ? { hour: "2-digit", minute: "2-digit", hour12: false } : {},
    timeZone: "America/Asuncion"
  }).format(d);
}
function textoPdf(valor) {
  return String(valor ?? "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/[^\u0000-\u00FF]/g, "?");
}
function tipoLabel(tipo) {
  return { ticket: "Ticket", contado: "Contado", credito: "Cr\xE9dito" }[String(tipo)] ?? String(tipo ?? "");
}
function estadoLabel(estado) {
  return { pagada: "Pagada", pendiente: "Pendiente", anulada: "Anulada", vencida: "Vencida", emitido: "Emitido" }[String(estado)] ?? String(estado ?? "");
}
function array(valor) {
  return Array.isArray(valor) ? valor : [];
}
function htmlFactura(f, config, formato, copia = false) {
  const ticket = formato === "ticket";
  const detalles = array(f.detalles).map((d) => `
    <tr>
      <td>${esc(d.producto_codigo)}</td>
      <td>${esc(d.producto_nombre)}</td>
      <td class="right">${esc(d.cantidad)}</td>
      <td class="right">Gs. ${fmt(d.precio_unitario)}</td>
      <td class="right">Gs. ${fmt(d.iva_monto)}</td>
      <td class="right">Gs. ${fmt(d.total_linea)}</td>
    </tr>`).join("");
  const pagos = array(f.pagos).map((p) => `
    <tr><td>${esc(fecha(p.fecha, true))}</td><td class="right">Gs. ${fmt(p.monto)}</td><td>${esc(p.metodo)}</td></tr>`).join("");
  const titulo = f.tipo_nota === "credito" ? "NOTA DE CR\xC9DITO" : f.tipo_nota === "debito" ? "NOTA DE D\xC9BITO" : "FACTURA";
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${titulo} ${esc(f.numero)}</title>
<style>
  @page { margin: ${ticket ? "8mm" : "15mm"}; size: ${ticket ? "80mm auto" : "A4"}; }
  * { box-sizing: border-box; }
  body { font-family: 'DejaVu Sans', Arial, sans-serif; font-size: ${ticket ? "10px" : "11px"}; color: #333; margin: 0; }
  .header { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #1a73e8; padding-bottom: 10px; }
  .header h1 { color: #1a73e8; margin: 0 0 4px; font-size: ${ticket ? "16px" : "20px"}; }
  .header h2 { font-size: ${ticket ? "13px" : "16px"}; margin-top: 8px; }
  .header p { margin: 1px 0; color: #666; font-size: 10px; }
  .info-table { width: 100%; margin-bottom: 12px; border-collapse: collapse; }
  .info-table td { vertical-align: top; padding: 2px 4px; }
  .label { font-weight: bold; width: 95px; color: #555; }
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  .items-table th { background: #1a73e8; color: white; padding: 5px 6px; text-align: left; font-size: 10px; }
  .items-table td { padding: 4px 6px; border-bottom: 1px solid #ddd; font-size: 10px; }
  .right { text-align: right; }
  .totals { width: 100%; max-width: 300px; margin-left: auto; }
  .totals td { padding: 3px 8px; }
  .total-row td { font-weight: bold; font-size: 13px; border-top: 2px solid #333; padding-top: 6px; }
  .footer { margin-top: 24px; text-align: center; font-size: 9px; color: #888; border-top: 1px solid #ddd; padding-top: 8px; }
  .motivo-nota { background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 6px 10px; margin-bottom: 12px; font-size: 10px; }
  .pagos-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  .pagos-table th { background: #e9ecef; padding: 4px 6px; text-align: left; font-size: 10px; }
  .pagos-table td { padding: 3px 6px; border-bottom: 1px solid #eee; font-size: 10px; }
  .copia { background: #fff3cd; border: 2px dashed #b45309; color: #92400e; text-align: center;
    padding: 6px 10px; margin-bottom: 12px; font-weight: bold; letter-spacing: 1px; }
</style>
</head>
<body>
<div class="header">
  <h1>${esc(config?.nombre || "FactuSYS")}</h1>
  <p>${esc(config?.ruc || "\u2014")}</p>
  <p>${esc(config?.direccion || "")}${config?.direccion && config?.telefono ? " \u2014 " : ""}${esc(config?.telefono || "")}</p>
  <p>${esc(config?.ciudad || "")}, Paraguay</p>
  ${f.timbrado_numero ? `<p><strong>Timbrado SET:</strong> ${esc(f.timbrado_numero)}</p>` : ""}
  <h2>${titulo} ${esc(f.numero)}</h2>
</div>
${copia ? '<div class="copia">COPIA \xB7 REIMPRESI\xD3N</div>' : ""}
${f.motivo_nota ? `<div class="motivo-nota"><strong>Motivo:</strong> ${esc(f.motivo_nota)}</div>` : ""}
<table class="info-table">
  <tr><td class="label">Cliente:</td><td>${esc(f.cliente_nombre || "Consumidor Final")}</td><td class="label">Fecha:</td><td>${esc(fecha(f.fecha_emision, true))}</td></tr>
  <tr><td class="label">RUC/CI:</td><td>${esc(f.cliente_ruc || "\u2014")}</td><td class="label">Tipo:</td><td>${esc(tipoLabel(f.tipo))}</td></tr>
  <tr><td class="label">Direcci\xF3n:</td><td>${esc(f.cliente_direccion || "\u2014")}</td><td class="label">Estado:</td><td>${esc(estadoLabel(f.estado))}</td></tr>
</table>
<table class="items-table">
  <thead><tr><th>C\xF3digo</th><th>Producto</th><th class="right">Cant.</th><th class="right">P. Unit.</th><th class="right">IVA</th><th class="right">Total</th></tr></thead>
  <tbody>${detalles}</tbody>
</table>
<table class="totals">
  <tr><td>Subtotal:</td><td class="right">Gs. ${fmt(f.subtotal)}</td></tr>
  <tr><td>IVA 10%:</td><td class="right">Gs. ${fmt(f.iva_10)}</td></tr>
  <tr class="total-row"><td>TOTAL:</td><td class="right">Gs. ${fmt(f.total)}</td></tr>
</table>
${pagos ? `<h3 style="margin-top:18px;font-size:12px;">Pagos</h3><table class="pagos-table"><thead><tr><th>Fecha</th><th class="right">Monto</th><th>M\xE9todo</th></tr></thead><tbody>${pagos}</tbody></table>` : ""}
<div class="footer">
  <p>Generado el ${esc(fecha(/* @__PURE__ */ new Date()))} \u2014 ${esc(config?.nombre || "FactuSYS")}</p>
  ${config?.pie_factura ? `<p>${esc(config.pie_factura)}</p>` : ""}
</div>
<script>
window.onload = function () { window.print(); window.onafterprint = function () { window.close(); }; };
</script>
</body>
</html>`;
}
async function pdfFactura(f, config, ticket, copia = false) {
  const doc = await PDFDocument.create();
  const normal = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ancho = ticket ? 302 : 595;
  const alto = 842;
  let pagina = doc.addPage([ancho, alto]);
  let y = alto - 40;
  const margen = ticket ? 18 : 42;
  const azul = rgb(0.1, 0.45, 0.91);
  const gris = rgb(0.4, 0.4, 0.4);
  function linea(valor, x = margen, size = 10, fuente = normal, color = rgb(0.2, 0.2, 0.2)) {
    if (y < 55) {
      pagina = doc.addPage([ancho, alto]);
      y = alto - 40;
    }
    pagina.drawText(textoPdf(valor), { x, y, size, font: fuente, color, maxWidth: ancho - margen * 2 });
    y -= size + 5;
  }
  function fila(celdas, anchos2, fuente = normal, size = 9) {
    if (y < 55) {
      pagina = doc.addPage([ancho, alto]);
      y = alto - 40;
    }
    let x = margen;
    celdas.forEach((celda, i) => {
      pagina.drawText(textoPdf(celda), { x, y, size, font: fuente, maxWidth: anchos2[i] - 4 });
      x += anchos2[i];
    });
    y -= size + 6;
  }
  if (copia) linea("COPIA \xB7 REIMPRESI\xD3N", margen, ticket ? 12 : 14, bold, rgb(0.7, 0.35, 0.05));
  linea(config?.nombre || "FactuSYS", margen, ticket ? 15 : 18, bold, azul);
  if (config?.ruc) linea(`RUC: ${config.ruc}`);
  if (config?.direccion) linea(config.direccion);
  if (config?.telefono) linea(`Tel: ${config.telefono}`);
  if (f.timbrado_numero) linea(`Timbrado: ${f.timbrado_numero}`);
  y -= 4;
  linea(`${f.tipo_nota === "credito" ? "NOTA DE CREDITO" : f.tipo_nota === "debito" ? "NOTA DE DEBITO" : "FACTURA"} ${f.numero}`, margen, 13, bold);
  y -= 6;
  linea(`Cliente: ${f.cliente_nombre || "Consumidor Final"}`);
  linea(`RUC/CI: ${f.cliente_ruc || "-"}`);
  linea(`Fecha: ${fecha(f.fecha_emision, true)}`);
  linea(`Tipo: ${tipoLabel(f.tipo)}   Estado: ${estadoLabel(f.estado)}`);
  if (f.motivo_nota) linea(`Motivo: ${f.motivo_nota}`);
  y -= 8;
  const util = ancho - margen * 2;
  const anchos = ticket ? [util * 0.3, util * 0.16, util * 0.24, util * 0.3] : [util * 0.36, util * 0.12, util * 0.25, util * 0.27];
  fila(ticket ? ["Producto", "Cant.", "P. Unit.", "Total"] : ["Producto", "Cant.", "P. Unit.", "Total"], anchos, bold, 9);
  for (const d of array(f.detalles)) {
    const nombre = `${d.producto_codigo ? `${d.producto_codigo} ` : ""}${d.producto_nombre ?? ""}`;
    fila([nombre, String(d.cantidad ?? ""), `Gs. ${fmt(d.precio_unitario)}`, `Gs. ${fmt(d.total_linea)}`], anchos);
  }
  y -= 8;
  fila(["Subtotal", "", "", `Gs. ${fmt(f.subtotal)}`], anchos);
  fila(["IVA 10%", "", "", `Gs. ${fmt(f.iva_10)}`], anchos);
  fila(["TOTAL", "", "", `Gs. ${fmt(f.total)}`], anchos, bold, 11);
  for (const p of array(f.pagos)) {
    y -= 8;
    linea(`Pago ${fecha(p.fecha, true)} - Gs. ${fmt(p.monto)} - ${p.metodo ?? ""}`);
  }
  y -= 14;
  linea(`Generado el ${fecha(/* @__PURE__ */ new Date())}`, margen, 8, normal, gris);
  if (config?.pie_factura) linea(config.pie_factura, margen, 8, normal, gris);
  const bytes = await doc.save();
  return new Response(bytes, {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="factura_${textoPdf(f.numero).replace(/[^\w-]/g, "_")}.pdf"`
    }
  });
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      throw new HttpError("Se requiere un token de Supabase Auth", 401);
    }
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const url = env("SUPABASE_URL");
    const anonKey = publishableKey();
    if (!anonKey) {
      throw new HttpError("Falta la publishable key de Supabase", 500);
    }
    const sesion = createClient(url, anonKey);
    const { data: auth, error: authError } = await sesion.auth.getUser(jwt);
    if (authError || !auth.user) throw new HttpError("Sesi\xF3n inv\xE1lida o expirada", 401);
    const client = createClient(url, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const urlParams = new URL(req.url).searchParams;
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const accion = String(body.accion ?? "reporte");
    if (accion !== "reporte") throw new HttpError(`Acci\xF3n no soportada: ${accion}`);
    const facturaId = Number(urlParams.get("factura_id") ?? body.factura_id);
    if (!Number.isInteger(facturaId) || facturaId <= 0) throw new HttpError("factura_id no v\xE1lido");
    const { data: filas, error: facturaError } = await client.from("v_facturas_detalle").select("*").eq("id", facturaId).limit(1);
    if (facturaError) throw new HttpError(facturaError.message, 400);
    const factura = filas?.[0];
    if (!factura) throw new HttpError("Factura no encontrada", 404);
    const { data: empresas, error: empresaError } = await client.from("v_empresa_config").select("*").limit(1);
    if (empresaError) throw new HttpError(empresaError.message, 400);
    const config = empresas?.[0] ?? {};
    const formato = String(urlParams.get("formato") ?? body.formato ?? (factura.tipo === "ticket" ? "ticket" : "a4"));
    const tipo = String(urlParams.get("tipo") ?? body.tipo ?? "print");
    const copia = body.copia === true;
    if (tipo === "pdf") return await pdfFactura(factura, config, formato === "ticket", copia);
    return new Response(htmlFactura(factura, config, formato, copia), {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" }
    });
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error("factusys-reportes", error);
    return json({ error: "Error interno de factusys-reportes" }, 500);
  }
});
