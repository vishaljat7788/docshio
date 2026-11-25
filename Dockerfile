# DocxMaster: Node.js server plus poppler for PDF rendering
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends poppler-utils qpdf ocrmypdf tesseract-ocr python3 python3-opencv python3-venv fonts-noto-core curl libreoffice-writer libreoffice-calc libreoffice-impress \
 && rm -rf /var/lib/apt/lists/*

# Install one offline English-to-Hindi model. Uploaded documents are translated
# inside this container; only the public model package is fetched at image build.
RUN python3 -m venv /opt/argos \
 && /opt/argos/bin/pip install --no-cache-dir argostranslate \
 && mkdir -p /opt/argos-data/packages \
 && curl -fsSL https://argos-net.com/v1/translate-en_hi-1_1.argosmodel -o /tmp/en-hi.argosmodel \
 && ARGOS_PACKAGES_DIR=/opt/argos-data/packages /opt/argos/bin/python -c "from argostranslate import package; package.install_from_path('/tmp/en-hi.argosmodel')" \
 && rm /tmp/en-hi.argosmodel

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/tmp/docxmaster \
    ARGOS_PACKAGES_DIR=/opt/argos-data/packages \
    ARGOS_PYTHON=/opt/argos/bin/python

# Run as the unprivileged "node" user that ships with the image
RUN mkdir -p /tmp/docxmaster && chown -R node:node /tmp/docxmaster /app
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
