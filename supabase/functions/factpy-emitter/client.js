// Cliente HTTP de FactPy. Usa FormData como exige la API oficial.
// Se puede inyectar `fetchImpl` en tests para no hacer llamadas reales.

export class FactpyError extends Error {
  constructor(mensaje, opciones = {}) {
    super(mensaje, opciones.cause ? { cause: opciones.cause } : undefined);
    this.name = 'FactpyError';
    this.code = opciones.code ?? null;
    this.status = opciones.status ?? null;
    this.response = opciones.response ?? null;
    this.retryable = opciones.retryable ?? false;
  }
}

export class FactpyClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'https://api.factpy.com/facturacion-api';
    // La documentación V1 publica /data/ y /evento/; versiones nuevas muestran .php.
    // Ambos se pueden cambiar por Secret sin tocar código.
    this.docsPath = config.docsPath || 'data/';
    this.eventosPath = config.eventosPath || 'evento/';
    this.estadoPath = config.estadoPath || 'estadoDE.php';
    this.recordId = config.recordId;
    this.fetchImpl = config.fetchImpl || globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? 15000;
    this.retries = config.retries ?? 2;
  }

  url(path) {
    return `${this.baseUrl.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }

  async emitir(payload) {
    return this.#post(this.docsPath, {
      dataJson: JSON.stringify(payload),
      recordID: this.recordId,
    });
  }

  async evento(payload) {
    return this.#post(this.eventosPath, {
      dataJson: JSON.stringify(payload),
      recordID: this.recordId,
    });
  }

  async consultarEstado(receiptids) {
    const cuerpo = Array.isArray(receiptids) ? { receiptid: receiptids } : receiptids;
    return this.#post(this.estadoPath, {
      receiptid: JSON.stringify(cuerpo),
      recordID: this.recordId,
    });
  }

  async #post(path, campos) {
    if (!this.recordId) {
      throw new FactpyError('FACTPY_RECORD_ID no está configurado', { retryable: false });
    }

    let ultimoError;

    for (let intento = 0; intento <= this.retries; intento += 1) {
      const body = new FormData();
      for (const [clave, valor] of Object.entries(campos)) {
        body.append(clave, typeof valor === 'string' ? valor : JSON.stringify(valor));
      }

      const control = new AbortController();
      const temporizador = setTimeout(() => control.abort(), this.timeoutMs);

      try {
        const respuesta = await this.fetchImpl(this.url(path), {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body,
          signal: control.signal,
        });
        clearTimeout(temporizador);

        const crudo = await respuesta.text();
        let json;
        try {
          json = crudo ? JSON.parse(crudo) : null;
        } catch {
          json = { status: false, code: `Respuesta no JSON (HTTP ${respuesta.status})`, raw: crudo };
        }

        if (!respuesta.ok) {
          const error = new FactpyError(json?.code || `HTTP ${respuesta.status}`, {
            code: json?.code ?? null,
            status: respuesta.status,
            response: json,
            retryable: respuesta.status === 429 || respuesta.status >= 500,
          });
          if (error.retryable && intento < this.retries) {
            await this.#esperar(intento);
            continue;
          }
          throw error;
        }

        if (json && json.status === false) {
          // Error funcional de FactPy/SIFEN: reintentar no cambia el payload.
          throw new FactpyError(json.code || 'FactPy devolvió status=false', {
            code: json.code ?? null,
            response: json,
            retryable: false,
          });
        }

        return json;
      } catch (error) {
        clearTimeout(temporizador);
        if (error instanceof FactpyError) {
          throw error;
        }

        const reintentable = error?.name === 'AbortError' || error instanceof TypeError;
        ultimoError = new FactpyError(error?.message || 'Error de red al llamar FactPy', {
          retryable: reintentable,
          cause: error,
        });

        if (reintentable && intento < this.retries) {
          await this.#esperar(intento);
          continue;
        }
        throw ultimoError;
      }
    }

    throw ultimoError || new FactpyError('No se pudo completar la solicitud');
  }

  async #esperar(intento) {
    await new Promise((resolver) => setTimeout(resolver, 250 * (intento + 1)));
  }
}
