# DocxMaster (Node.js version)

PDF tools web app. The browser sends files to a Node.js (Express) server, the server processes them, and the result is downloaded. Uploaded files and results are deleted automatically (after 30 minutes by default).

Tools include Merge, Split, Remove pages, Rotate, Images to PDF, PDF to JPG, Compress, Watermark, Page numbers, Office and HTML conversions, typed PDF annotation/signature, and password protect/unlock.

## Run locally

You need Node.js 18 or newer. PDF-to-JPG runs in the browser with PDF.js; the server-side API fallback uses poppler-utils.

1. Install the system programs
   - Mac: `brew install poppler`
   - Ubuntu/Debian: `sudo apt install poppler-utils`
   - Windows: install poppler and add its `bin` folder to PATH. Docker (below) is easier on Windows.
2. In this folder run:
   ```
   npm install
   npm start
   ```
3. Open http://localhost:3000

Office and HTML conversions require LibreOffice. The website protects and unlocks PDFs in the browser with qpdf compiled to WebAssembly; direct server API calls for those tools still require qpdf installed.

## Run with Docker (easiest, includes everything)
```
docker build -t docxmaster .
docker run -p 3000:3000 docxmaster
```

## Deploy the website on Vercel

Vercel hosts the static website; the document-processing API needs to run as a Docker service. The API uses Poppler, LibreOffice and qpdf, writes temporary uploads/results to disk, and serves download links from that same disk. A Vercel Function is not a drop-in replacement for this backend: function requests/responses have a 4.5 MB payload limit and Vercel's external proxy has a 120-second request timeout.

1. Build and deploy this repository's Dockerfile to a container host that supports Docker. The image includes Poppler, LibreOffice Writer/Calc/Impress and qpdf. Keep one API instance unless its upload/result files are moved to shared storage; a download request must reach the instance that processed the file.
2. Set `TOOL_TIMEOUT_SECONDS=100` on the API service so long conversions finish within Vercel's external proxy timeout. Set `TRUST_PROXY=true` if the API host is behind its trusted reverse proxy.
3. In `vercel.json`, replace both `https://docxmaster-api.example.com` destinations with the deployed API's HTTPS origin (no trailing slash).
4. Import the repository into Vercel and deploy. The build copies the shared tool registry into `public/shared` and publishes `public` as the static output directory. `/api/*` and `/healthz` are proxied to the Docker API, so browser uploads and download links stay on the DocxMaster domain.

The API keeps its 50 MB per-file limit. Its native PDF/Office tools are installed in the Docker image, while Vercel only serves the site and proxies requests. PDF-to-JPG, Protect PDF and Unlock PDF run in the browser; the QPDF WebAssembly license is published at `/licenses/qpdf-wasm-LICENSE.txt`.

## Test
`npm test` starts the server on a random port and runs the available end-to-end and security checks. The server API's PDF-to-JPG check is skipped when Poppler is not installed; the website converts PDF pages to JPG in the browser.

## Settings (environment variables)
See `.env.example`. The important ones: `MAX_FILE_MB` (per-file limit), `JOB_TTL_MINUTES` (how long results are kept), `RATE_LIMIT` (requests per IP per 10 minutes) and `TRUST_PROXY` (set to true behind a reverse proxy so rate limiting sees real IPs).

## How it is built
- `server.js`: Express app, security headers, upload limits, rate limiting, downloads, cleanup
- `shared/tools-meta.js`: the tool list and options. The browser uses it to draw the page and the server uses it to validate every request
- `src/handlers.js`: the code for each tool (pdf-lib, sharp, pdftoppm, LibreOffice and qpdf)
- `src/options.js`: rebuilds options from the tool definition so unknown or invalid values never reach a tool
- `public/`: the web page (HTML, CSS, JavaScript). pdf.js is used only for thumbnails

## Add a tool
1. Add its definition to `shared/tools-meta.js`.
2. Add `handlers.set('your-id', async (files, options, ctx) => [...])` in `src/handlers.js`, returning `[{ name, data: Buffer }]`.
3. Add an icon path to `ICONS` in `public/js/app.js`.

## Security notes
- Only PDFs (checked by file signature) or decodable images are accepted. File names are never used as paths on disk.
- Options are validated on the server. External programs run with `execFile` (no shell), a timeout and fixed arguments.
- Rate limit, per-file size limit, file count limit and a strict Content-Security-Policy are on by default.
- Download links use unguessable random tokens and expire.
- The browser preview uses pdf.js with `isEvalSupported: false` (mitigates CVE-2024-4367).
- Before going public: serve over HTTPS (reverse proxy or your host), keep dependencies updated (`npm audit`), and consider running jobs in worker threads or separate containers. One very heavy PDF can keep a single Node process busy.
- There is no login or per-user storage. Anyone who has a download link can download that file until it expires.

## Limits
- Watermark and typed annotations use standard PDF fonts and support English letters, numbers and common symbols only.
- PDF to Word/PowerPoint/Excel conversion quality depends on LibreOffice and may not preserve complex layouts. A typed signature is not a certificate-based digital signature.
- Branding is original. Do not copy another site's name, logo or design.
