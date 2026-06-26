FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    build-essential \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

RUN set -eux; \
    SUPERCRONIC_URL="https://github.com/aptible/supercronic/releases/download/v0.2.46/supercronic-linux-amd64"; \
    SUPERCRONIC="supercronic-linux-amd64"; \
    SUPERCRONIC_SHA1SUM="5bcefed628e32adc08e32634db2d10e9230dbca0"; \
    curl -fsSL "$SUPERCRONIC_URL" -o "$SUPERCRONIC"; \
    echo "${SUPERCRONIC_SHA1SUM}  ${SUPERCRONIC}" | sha1sum -c -; \
    chmod +x "$SUPERCRONIC"; \
    mv "$SUPERCRONIC" "/usr/local/bin/${SUPERCRONIC}"; \
    ln -s "/usr/local/bin/${SUPERCRONIC}" /usr/local/bin/supercronic

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chmod +x entrypoint.sh entrypoint-backup.sh

ENTRYPOINT ["/app/entrypoint.sh"]
