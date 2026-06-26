# Módulo SIFEN — Facturación Electrónica SET/DNIT

## Estado actual

App funcional con todos los componentes básicos implementados y documentados.
Pendiente de homologación real contra el ambiente del SET.

## Archivos del módulo

| Archivo | Propósito |
|---------|-----------|
| `models.py` | Modelo `EventoSifen` para auditoría de envíos |
| `cdc.py` | Algoritmo de cálculo del CDC (44 caracteres) |
| `xml_generator.py` | Generación del XML del DE (V150) |
| `firma.py` | Firma digital XMLDSig con certificado PKCS#12 |
| `soap_client.py` | Comunicación SOAP con el webservice del SET |
| `client.py` | Orquestador de alto nivel (genera + firma + envía) |
| `signals.py` | Signals para envío automático al crear factura |
| `views.py` | Endpoints REST: configuración y consulta de eventos |
| `serializers.py` | Serializer de EventoSifen |
| `urls.py` | Rutas del módulo |
| `admin.py` | Admin de Django para EventoSifen |
| `kude.py` | Generación de PDF del KuDE (comprobante + QR) |
| `tests.py` | Tests unitarios (CDC, modelos, KuDE) |
| `management/commands/sifen_enviar.py` | Comando `manage.py sifen_enviar` |

## Flujo de envío de un DE

```
Factura → generar_xml_de() → XML sin firmar
                              ↓
                         sign_xml() → XML firmado
                              ↓
                        enviar_de() → SOAP → SET
                              ↓
                    Respuesta: protocolo o errores
                              ↓
                    EventoSifen guardado en BD
```

## Próximos pasos para homologación

1. Contar con certificado digital PKCS#12 emitido por la DNIT
2. Tener un timbrado vigente para facturación electrónica
3. Probar envío con `python manage.py sifen_enviar <factura_id>`
4. Revisar respuesta del SET y corregir errores de validación
5. Repetir hasta obtener protocolo de aceptación
6. Habilitar envío automático en `signals.py`

## Errores comunes de homologación

| Código | Descripción |
|--------|-------------|
| 1358 | Error en el cálculo del CDC |
| 1360 | RUC del emisor inválido |
| 1362 | Certificado digital no autorizado |
| 1370 | Error en la estructura del XML |
| Otros | Consultar manual técnico del SET |
