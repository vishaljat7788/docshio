# DocxMaster: Node.js server plus poppler for PDF rendering
FROM node:22-bookworm-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends poppler-utils qpdf libreoffice-writer libreoffice-calc libreoffice-impress \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/tmp/docxmaster

# Run as the unprivileged "node" user that ships with the image
RUN mkdir -p /tmp/docxmaster && chown -R node:node /tmp/docxmaster /app
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
