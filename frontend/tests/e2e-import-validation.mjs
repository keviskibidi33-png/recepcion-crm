import { chromium } from 'playwright';
import { spawn, spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_DIR = path.resolve(__dirname, '..');
const TEST_PORT = 4317;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const START_URL = `${BASE_URL}/migration/nueva-recepcion?token=e2e-import-token`;

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) return resolve();
      } catch (_) {}
      if (Date.now() - start > timeoutMs) {
        return reject(new Error(`Server did not start in ${timeoutMs}ms`));
      }
      setTimeout(attempt, 500);
    };
    attempt();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function killProcessOnPort(port) {
  if (process.platform !== 'win32') return;
  spawnSync(
    'powershell',
    [
      '-NoProfile',
      '-Command',
      `$conns = Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue; if ($conns) { ($conns | Select-Object -ExpandProperty OwningProcess -Unique) | ForEach-Object { if ($_ -ne 0) { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } }`
    ],
    { stdio: 'ignore' }
  );
}

function killChildTree(proc) {
  if (!proc || !proc.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try { proc.kill('SIGKILL'); } catch (_) {}
}

async function main() {
  let previewProcess;
  let browser;
  try {
    killProcessOnPort(TEST_PORT);

    const previewArgs = ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(TEST_PORT), '--strictPort'];
    if (process.platform === 'win32') {
      previewProcess = spawn('cmd.exe', ['/c', 'npm', ...previewArgs], {
        cwd: FRONTEND_DIR,
        stdio: 'pipe',
      });
    } else {
      previewProcess = spawn('npm', previewArgs, {
        cwd: FRONTEND_DIR,
        stdio: 'pipe',
      });
    }

    previewProcess.stdout.on('data', (d) => process.stdout.write(`[preview] ${d}`));
    previewProcess.stderr.on('data', (d) => process.stderr.write(`[preview-err] ${d}`));

    await waitForServer(BASE_URL);

    const importedData = {
      numero_ot: 'OT-999-26',
      numero_recepcion: '999-26',
      numero_cotizacion: '999-COT-26',
      cliente: 'CLIENTE E2E',
      domicilio_legal: 'AV PRUEBA 123',
      ruc: '20123456789',
      persona_contacto: 'ING TEST',
      email: '/',
      telefono: '999888777',
      solicitante: 'SOLICITANTE TEST',
      domicilio_solicitante: 'DIR SOLICITANTE 321',
      proyecto: 'PROYECTO E2E',
      ubicacion: 'LIMA',
      fecha_recepcion: '02/03/2026',
      entregado_por: 'TECNICO TEST',
      recibido_por: 'ASISTENTE TEST',
      muestras: [
        {
          codigo_muestra_lem: '1001-CO-26',
          identificacion_muestra: 'MUESTRA VALIDA',
          estructura: 'VIGA',
          fc_kg_cm2: 280,
          fecha_moldeo: '01/03/2026',
          hora_moldeo: '08:00:00',
          edad: 7,
          fecha_rotura: '08/03/2026',
          requiere_densidad: false
        },
        {
          codigo_muestra_lem: '',
          identificacion_muestra: '',
          estructura: '',
          fc_kg_cm2: '',
          fecha_moldeo: '',
          hora_moldeo: '',
          edad: '',
          fecha_rotura: '',
          requiere_densidad: false
        }
      ]
    };

    let createdPayload = null;

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('console', (msg) => {
      const text = msg.text();
      if (text) console.log(`[browser:${msg.type()}] ${text}`);
    });
    page.on('pageerror', (err) => {
      console.log(`[browser:pageerror] ${err.message}`);
    });
    page.on('requestfailed', (req) => {
      console.log(`[browser:reqfailed] ${req.method()} ${req.url()} -> ${req.failure()?.errorText || 'unknown'}`);
    });

    await page.route('**/api/recepcion/**', async (route) => {
      const request = route.request();
      const url = request.url();
      const method = request.method();

      if (method === 'GET' && url.includes('/api/recepcion/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      }

      if (method === 'POST' && url.endsWith('/api/recepcion/')) {
        createdPayload = JSON.parse(request.postData() || '{}');
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 9999,
            ...createdPayload,
            estado: createdPayload.estado || 'PENDIENTE',
            fecha_creacion: new Date().toISOString(),
            muestras: (createdPayload.muestras || []).map((m, i) => ({ id: i + 1, ...m, fecha_creacion: new Date().toISOString() })),
          }),
        });
      }

      return route.fallback();
    });

    await page.goto(START_URL);
    await page.waitForTimeout(1500);
    const bodyText = await page.locator('body').innerText();
    console.log(`DEBUG URL after goto: ${page.url()}`);
    console.log(`DEBUG body starts with: ${bodyText.slice(0, 220).replace(/\s+/g, ' ')}`);
    await page.waitForSelector('form');

    await page.evaluate((data) => {
      window.postMessage({ type: 'IMPORT_DATA', data }, '*');
    }, importedData);
    await page.waitForTimeout(800);

    const emailValue = await page.locator('textarea[name="email"]').inputValue();
    const sampleRows = await page.locator('tbody tr').count();

    assert(emailValue === '', `Expected sanitized email to be empty, got: "${emailValue}"`);
    assert(sampleRows === 1, `Expected only 1 sanitized muestra row, got: ${sampleRows}`);

    await page.fill('input[name="numero_ot"]', 'OT-999-26');
    await page.fill('input[name="numero_recepcion"]', '999-26');
    await page.fill('input[name="cliente"]', 'CLIENTE E2E');
    await page.fill('textarea[name="domicilio_legal"]', 'AV PRUEBA 123');
    await page.fill('input[name="ruc"]', '20123456789');
    await page.fill('input[name="persona_contacto"]', 'ING TEST');
    await page.fill('input[name="telefono"]', '999888777');
    await page.fill('input[name="solicitante"]', 'SOLICITANTE TEST');
    await page.fill('textarea[name="domicilio_solicitante"]', 'DIR SOLICITANTE 321');
    await page.fill('input[name="proyecto"]', 'PROYECTO E2E');
    await page.fill('textarea[name="ubicacion"]', 'LIMA');
    await page.fill('input[name="fecha_recepcion"]', '02/03/2026');
    await page.fill('input[name="entregado_por"]', 'TECNICO TEST');
    await page.fill('input[name="recibido_por"]', 'ASISTENTE TEST');

    await page.fill('textarea[name="muestras.0.identificacion_muestra"]', 'MUESTRA VALIDA');
    await page.fill('textarea[name="muestras.0.estructura"]', 'VIGA');
    await page.fill('input[name="muestras.0.fc_kg_cm2"]', '280');
    await page.fill('input[name="muestras.0.edad"]', '7');
    await page.fill('input[name="muestras.0.fecha_moldeo"]', '01/03/2026');
    await page.fill('input[name="muestras.0.fecha_rotura"]', '08/03/2026');

    await page.click('button[type="submit"]');

    const deadline = Date.now() + 10000;
    while (!createdPayload && Date.now() < deadline) {
      await page.waitForTimeout(200);
    }

    assert(!!createdPayload, 'Create request was not sent');
    assert(createdPayload.email === '', `Expected submitted email to be empty, got: "${createdPayload.email}"`);
    assert(Array.isArray(createdPayload.muestras), 'Submitted muestras is not an array');
    assert(createdPayload.muestras.length === 1, `Expected submitted muestras length 1, got: ${createdPayload.muestras.length}`);
    assert(createdPayload.muestras[0].identificacion_muestra === 'MUESTRA VALIDA', 'Expected first muestra to remain valid');

    console.log('\nPASS: Importación validada para escenario producción (email placeholder + ghost row).');
    console.log(`PASS: Payload final -> email="${createdPayload.email}", muestras=${createdPayload.muestras.length}`);
  } finally {
    if (browser) await browser.close();
    killChildTree(previewProcess);
    killProcessOnPort(TEST_PORT);
  }
}

main().catch((err) => {
  console.error('\nFAIL: E2E import validation failed');
  console.error(err);
  process.exit(1);
});
