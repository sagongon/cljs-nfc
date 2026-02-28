// ✅ server.js – גרסה מתקדמת עם ברירת מחדל וניהול גיליון דינמי
import express from 'express';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 💾 Persisted Active Sheet (Render Persistent Disk)
// Set DISK_MOUNT_PATH in Render to your disk mount path (e.g. /var/data). Default tries /var/data.
const DISK_MOUNT_PATH = process.env.DISK_MOUNT_PATH || '/var/data';
const ACTIVE_SHEET_FILE = path.join(DISK_MOUNT_PATH, 'activeSheet.json');

function readActiveSheetIdFromDisk() {
  try {
    if (!fs.existsSync(ACTIVE_SHEET_FILE)) return null;
    const raw = fs.readFileSync(ACTIVE_SHEET_FILE, 'utf8');
    const data = JSON.parse(raw);
    const id = typeof data?.spreadsheetId === 'string' ? data.spreadsheetId.trim() : '';
    return id || null;
  } catch (err) {
    console.log('⚠️ Failed reading activeSheet.json:', err?.message || err);
    return null;
  }
}

function saveActiveSheetIdToDisk(spreadsheetId) {
  try {
    const id = (spreadsheetId || '').toString().trim();
    if (!id) return false;
    fs.mkdirSync(DISK_MOUNT_PATH, { recursive: true });
    fs.writeFileSync(
      ACTIVE_SHEET_FILE,
      JSON.stringify({ spreadsheetId: id, updatedAt: new Date().toISOString() }, null, 2),
      'utf8'
    );
    return true;
  } catch (err) {
    console.log('❌ Failed saving activeSheet.json:', err?.message || err);
    return false;
  }
}

dns.setDefaultResultOrder('ipv4first');
process.env.GOOGLE_API_USE_MTLS_ENDPOINT = 'never';

const app = express();
app.use(express.json());

// ✅ הגדרות CORS מלאות עם טיפול מפורש ב-OPTIONS
// ✅ החרגה ל-/bridge/* כדי שה-Android Bridge יעבוד גם בלי Origin
app.use((req, res, next) => {
  const origin = req.headers.origin;

  // ✅ allow bridge endpoints regardless of origin (android app / no origin)
  if (req.url.startsWith('/bridge/')) {
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    return next();
  }

  const allowedOrigins = ['https://cljs-nfc-ashy.vercel.app'];

  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

console.log('✅ CORS מוגדר');

app.use((req, res, next) => {
  console.log(`📥 בקשה מ: ${req.headers.origin || '[none]'} לנתיב ${req.url}`);
  next();
});

// ===== NFC BRIDGE SUPPORT =====
// אופציונלי: הגדר ב-Render ENV -> NFC_BRIDGE_SECRET=someSecret
const latestUidByStation = new Map();
const UID_TTL_MS = 15000;

app.post('/bridge/uid', (req, res) => {
  const { stationId, uid, secret } = req.body || {};

  console.log('🚨 /bridge/uid CALLED');
  console.log('BODY:', req.body);
  console.log('HEADERS ORIGIN:', req.headers.origin);

  if (process.env.NFC_BRIDGE_SECRET) {
    if (!secret || secret !== process.env.NFC_BRIDGE_SECRET) {
      return res.status(403).json({ error: 'bad secret' });
    }
  }

  if (!stationId || !uid) {
    return res.status(400).json({ error: 'stationId and uid required' });
  }

  latestUidByStation.set(String(stationId), {
    uid: String(uid).trim(),
    ts: Date.now()
  });

  return res.json({ ok: true });
});

app.get('/bridge/latest', (req, res) => {
  const stationId = String(req.query.stationId || '').trim();
  if (!stationId) {
    return res.status(400).json({ error: 'stationId required' });
  }

  const rec = latestUidByStation.get(stationId);
  if (!rec || Date.now() - rec.ts > UID_TTL_MS) {
    return res.json({ uid: '' });
  }

  latestUidByStation.delete(stationId);
  res.json({ uid: rec.uid });
});

// ✅ Health check endpoint - מונע השעיה ב-Render
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 4000;

// 🟡 ברירת מחדל + מזהה פעיל (עדיפות: דיסק -> ENV -> ברירת מחדל)
let DEFAULT_SPREADSHEET_ID = process.env.DEFAULT_SPREADSHEET_ID || '';
const PERSISTED_SHEET_ID = readActiveSheetIdFromDisk();
let ACTIVE_SPREADSHEET_ID =
  PERSISTED_SHEET_ID || process.env.ACTIVE_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;

console.log("📄 DEFAULT_SPREADSHEET_ID:", DEFAULT_SPREADSHEET_ID || "[לא מוגדר]");
console.log("📄 ACTIVE_SPREADSHEET_ID בתחילת טעינה:", ACTIVE_SPREADSHEET_ID || "[לא מוגדר]");
console.log("💾 Persisted sheet file:", ACTIVE_SHEET_FILE);
console.log("💾 Persisted sheet id:", PERSISTED_SHEET_ID || "[אין]");

if (!ACTIVE_SPREADSHEET_ID) {
  console.error('❌ לא מוגדר Spreadsheet ID פעיל או ברירת מחדל – הפסקת השרת');
  process.exit(1);
}

// ✅ פונקציה שתשתמש תמיד במזהה הנוכחי (אם תרצה בעתיד)
function getActiveSheetId() {
  return ACTIVE_SPREADSHEET_ID;
}

let credentials;
let CREDENTIALS_PATH;

if (process.env.GOOGLE_CREDENTIALS_JSON) {
  credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
} else {
  CREDENTIALS_PATH = process.env.GOOGLE_SA_PATH;
  credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
const sheets = google.sheets({ version: 'v4', auth });

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const JUDGE_PASSWORD = process.env.JUDGE_PASSWORD;

const attemptsMemory = {};
// ===============================
// ✅ Queue persistence to disk
// ===============================

// תורים בזיכרון
let queues = {};
let queuesPersistenceEnabled = true;

// איפה לשמור על הדיסק (אם יש לך mount של Render Disk, שים אותו ב-RENDER_DISK_PATH)
const DISK_DIR = DISK_MOUNT_PATH; // אותו דיסק כמו activeSheet.json
const QUEUES_FILE = path.join(DISK_DIR, 'queues.json');

// טעינה מהדיסק (בעליית שרת)
function loadQueuesFromDisk() {
  try {
    if (!fs.existsSync(QUEUES_FILE)) {
      console.log('ℹ️ queues.json לא קיים עדיין (תקין בפעם הראשונה)');
      queues = {};
      return;
    }

    const raw = fs.readFileSync(QUEUES_FILE, 'utf8');
    const parsed = JSON.parse(raw || '{}');

    // ✅ תאימות לאחור: אם פעם שמרת רק queues (בלי sheetId)
    if (parsed && typeof parsed === 'object' && !('sheetId' in parsed) && !('queues' in parsed)) {
      queues = parsed;
      console.log('✅ queues נטען מהדיסק (פורמט ישן)');

      // משדרג מייד לפורמט החדש על אותו sheet
      fs.writeFileSync(
        QUEUES_FILE,
        JSON.stringify({ sheetId: ACTIVE_SPREADSHEET_ID, queues }, null, 2),
        'utf8'
      );
      return;
    }

    const fileSheetId = (parsed?.sheetId || '').toString().trim();
    const fileQueues = parsed?.queues;

    // אם הקובץ שייך לתחרות אחרת -> מתחילים תור חדש
    if (fileSheetId && fileSheetId !== ACTIVE_SPREADSHEET_ID) {
  console.log(
    `⚠️ queues.json שייך לגיליון אחר (${fileSheetId}) אבל ACTIVE הוא ${ACTIVE_SPREADSHEET_ID}. ` +
    `לא טוען תור ולא כותב לדיסק. איפוס יקרה רק אחרי set-active-sheet ביוזמה.`
  );
  queues = {};
  queuesPersistenceEnabled = false; // 🔒 חוסם שמירה אוטומטית כדי לא לדרוס queues.json
  return;
}

    queues = (fileQueues && typeof fileQueues === 'object') ? fileQueues : {};
    console.log('✅ queues נטען מהדיסק');

  } catch (err) {
    console.error('⚠️ כשל בטעינת queues מהדיסק:', err.message);
    queues = {};
  }
}


// איפוס תור כאשר עוברים לגיליון/תחרות חדשה
function resetQueuesForNewSheet() {
  queues = {};
  queuesPersistenceEnabled = true; // ✅ אחרי set-active-sheet חוזרים לשמור תורים

  try {
    fs.mkdirSync(DISK_DIR, { recursive: true });
    fs.writeFileSync(
      QUEUES_FILE,
      JSON.stringify({ sheetId: ACTIVE_SPREADSHEET_ID, queues }, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error('❌ כשל באיפוס queues לדיסק:', err.message);
  }
  console.log('🧹 תורים אופסו עבור גיליון חדש:', ACTIVE_SPREADSHEET_ID);
}

// כתיבה לדיסק (debounce)
let saveTimer = null;
let dirtyQueues = false;

function scheduleSaveQueues() {
  if (!queuesPersistenceEnabled) return; // 🔒 לא כותבים לדיסק אם sheet לא תואם
  dirtyQueues = true;
  if (saveTimer) return;

  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!dirtyQueues) return;
    dirtyQueues = false;

    try {
      fs.mkdirSync(DISK_DIR, { recursive: true });
      fs.writeFileSync(
  QUEUES_FILE,
  JSON.stringify({ sheetId: ACTIVE_SPREADSHEET_ID, queues }, null, 2),
  'utf8'
);

    } catch (err) {
      console.error('❌ כשל בשמירת queues לדיסק:', err.message);
    }
  }, 250);
}

// Snapshot קבוע
setInterval(() => {
  if (!queuesPersistenceEnabled) return; // 🔒 לא כותבים לדיסק אם sheet לא תואם
  try {
    fs.mkdirSync(DISK_DIR, { recursive: true });
    fs.writeFileSync(
      QUEUES_FILE,
      JSON.stringify({ sheetId: ACTIVE_SPREADSHEET_ID, queues }, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error('❌ snapshot queues נכשל:', err.message);
  }
}, 15 * 1000);

async function ensureNFCMapSheet() {
  const sheetMeta = await sheets.spreadsheets.get({
    spreadsheetId: ACTIVE_SPREADSHEET_ID
  });
  const sheetNames = sheetMeta.data.sheets.map((s) => s.properties.title);
  if (!sheetNames.includes('NFCMap')) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: 'NFCMap' } } }],
      },
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: 'NFCMap!A1:B1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [['UID', 'Name']] },
    });
    console.log('🆕 נוצר גיליון NFCMap');
  }
}

function getExcelColumnName(n) {
  let result = '';
  while (n > 0) {
    n--;
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

async function ensureAllAttemptsSheet() {
  try {
    const sheetMeta = await sheets.spreadsheets.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID
    });
    const sheetNames = sheetMeta.data.sheets.map((s) => s.properties.title);
    if (!sheetNames.includes('AllAttempts')) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: ACTIVE_SPREADSHEET_ID,
        requestBody: {
          requests: [{ addSheet: { properties: { title: 'AllAttempts' } } }],
        },
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId: ACTIVE_SPREADSHEET_ID,
        range: 'AllAttempts!A1:F1',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [['שם מתחרה', 'מסלול', 'תוצאה', 'מספר ניסיון', 'תאריך', 'מספר תחנה']] },
      });
      console.log('🆕 נוצר גיליון AllAttempts');
    }
  } catch (err) {
    console.error('⚠️ שגיאה ב-ensureAllAttemptsSheet:', err.message);
    if (err.code === 403) {
      console.error('❌ אין הרשאה לגיליון. ודא שה-service account מקבל הרשאה לגיליון או שהגיליון פתוח לגישה לכל מי שיש לו את הלינק.');
    }
    throw err;
  }
}

async function restoreAttemptsMemory() {
  console.log('🔄 שיחזור memory מהגיליון AllAttempts...');
  try {
    await ensureAllAttemptsSheet();
  } catch (err) {
    console.error('❌ לא ניתן לגשת לגיליון AllAttempts. השרת יעבוד ללא שיחזור memory:', err.message);
    return;
  }
  
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: 'AllAttempts!A2:E',
    });
    const rows = res.data.values || [];
    const tempMemory = {};
    for (const [name, routeStr, result] of rows) {
      const route = parseInt(routeStr, 10);
      if (!tempMemory[name]) tempMemory[name] = {};
      if (!tempMemory[name][route]) tempMemory[name][route] = [];
      if (result === 'RESET') tempMemory[name][route] = [];
      else if (['X', 'T'].includes(result)) tempMemory[name][route].push(result);
    }
    for (const name in tempMemory) {
      attemptsMemory[name] = {};
      for (const route in tempMemory[name]) {
        const history = tempMemory[name][route];
        const lastTIndex = history.lastIndexOf('T');
        attemptsMemory[name][route] = lastTIndex === -1 ? history : history.slice(0, lastTIndex + 1);
      }
    }
    console.log('✅ attemptsMemory שוחזר בהצלחה מתוך AllAttempts');
  } catch (err) {
    console.error('❌ שגיאה בשחזור:', err.message);
  }
}

async function logToAttemptsSheet(name, route, result) {
  if (result !== 'T') return;
  try {
    const getNames = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: 'Atempts!B2:B',
    });
    const rowIndex = getNames.data.values.findIndex((row) => row[0] === name);
    if (rowIndex === -1) return;
    const excelRow = rowIndex + 2;
    const columnLetter = getExcelColumnName(parseInt(route, 10) + 2);
    const attemptCount = attemptsMemory[name]?.[parseInt(route, 10)]?.length || '';
    await sheets.spreadsheets.values.update({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: `Atempts!${columnLetter}${excelRow}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[attemptCount]] },
    });
    console.log(`✅ כתיבה ל-Atempts (${name}, מסלול ${route}, ניסיון ${attemptCount})`);
  } catch (err) {
    console.error('❌ שגיאה בעדכון גיליון Atempts:', err.message);
  }
}

// 🔁 רענון תקופתי: סנכרון Atempts מתוך AllAttempts (תיקון "נכתב רק ל-AllAttempts")
let isReconcilingAtempts = false;

async function buildAtemptsRowMap() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: ACTIVE_SPREADSHEET_ID,
    range: 'Atempts!B2:B',
  });
  const names = res.data.values || [];
  const map = new Map(); // name -> excelRow
  for (let i = 0; i < names.length; i++) {
    const name = (names[i]?.[0] || '').toString().trim();
    if (name) map.set(name, i + 2); // row index in sheet
  }
  return map;
}

// מחזיר Map: name -> Map(routeNum -> {attempts: number|string(''), isReset:boolean})
async function computeLatestAtemptsFromAllAttempts() {
  await ensureAllAttemptsSheet();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: ACTIVE_SPREADSHEET_ID,
    range: 'AllAttempts!A2:F',
  });
  const rows = res.data.values || [];

  const out = new Map();

  const setVal = (name, routeNum, payload) => {
    if (!out.has(name)) out.set(name, new Map());
    out.get(name).set(routeNum, payload);
  };

  for (const row of rows) {
    const name = (row?.[0] || '').toString().trim();
    const routeNum = parseInt((row?.[1] || '').toString(), 10);
    const result = (row?.[2] || '').toString().trim();
    const attemptStr = (row?.[3] || '').toString().trim();

    if (!name || !Number.isFinite(routeNum)) continue;

    if (result === 'RESET') {
      setVal(name, routeNum, { attempts: '', isReset: true });
      continue;
    }

    if (result === 'T') {
      const attempts = parseInt(attemptStr, 10);
      if (Number.isFinite(attempts) && attempts > 0) {
        setVal(name, routeNum, { attempts, isReset: false });
      }
    }
  }

  return out;
}

async function reconcileAtemptsFromAllAttempts() {
  if (isReconcilingAtempts) return;
  isReconcilingAtempts = true;

  try {
    const [rowMap, latest] = await Promise.all([
      buildAtemptsRowMap(),
      computeLatestAtemptsFromAllAttempts(),
    ]);

    const data = [];

    for (const [name, routesMap] of latest.entries()) {
      const excelRow = rowMap.get(name);
      if (!excelRow) continue;

      for (const [routeNum, payload] of routesMap.entries()) {
        const colLetter = getExcelColumnName(routeNum + 2);
        data.push({
          range: `Atempts!${colLetter}${excelRow}`,
          values: [[payload.attempts === '' ? '' : payload.attempts]],
        });
      }
    }

    if (data.length === 0) return;

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data,
      },
    });

    console.log(`🔁 reconcileAtemptsFromAllAttempts: עודכנו ${data.length} תאים ב-Atempts`);
  } catch (err) {
    console.error('❌ reconcileAtemptsFromAllAttempts failed:', err?.message || err);
  } finally {
    isReconcilingAtempts = false;
  }
}

app.post('/sync-offline', async (req, res) => {
  const { attempts } = req.body;
  if (!Array.isArray(attempts)) return res.status(400).json({ error: 'invalid format' });

  const results = [];
  for (const { name, route, result, stationId: stationIdAttempt } of attempts) {
    const routeNum = parseInt(route, 10);
    if (!attemptsMemory[name]) attemptsMemory[name] = {};
    if (!attemptsMemory[name][routeNum]) attemptsMemory[name][routeNum] = [];

    const history = attemptsMemory[name][routeNum];
    if (history.includes('T') || history.length >= 5) {
      results.push({ name, route, result, skipped: true });
      continue;
    }

    history.push(result);
    const attemptNumber = history.length;
    try {
      await ensureAllAttemptsSheet();

      await sheets.spreadsheets.values.append({
        spreadsheetId: ACTIVE_SPREADSHEET_ID,
        range: 'AllAttempts!A:F',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            name,
            routeNum,
            result,
            result === 'T' ? attemptNumber : '',
            new Date().toLocaleString('he-IL'),
            (typeof stationIdAttempt !== 'undefined' ? stationIdAttempt : '')
          ]],
        },
      });

      await logToAttemptsSheet(name, routeNum, result);
      results.push({ name, route: routeNum, result, saved: true });
    } catch (err) {
      console.error('❌ שגיאה בסנכרון אופליין:', err.message);
      results.push({ name, route: routeNum, result, error: true });
    }
  }

  const count = results.filter(r => r.saved).length;
  res.json({ message: 'OFFLINE SYNC COMPLETE', results, count });
});

app.get('/competitors', async (req, res) => {
  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: 'Atempts!B2:B',
    });
    const names = result.data.values?.map((row) => row[0]) || [];
    res.json({ competitors: names });
  } catch {
    res.status(500).json({ error: 'שגיאה בשליפת מתחרים' });
  }
});

app.get('/history', async (req, res) => {
  for (const key in attemptsMemory) delete attemptsMemory[key];
  await restoreAttemptsMemory();

  const { name, route } = req.query;
  const routeNum = parseInt(route, 10);
  const history = attemptsMemory[name]?.[routeNum] || [];
  const locked = history.includes('T') || history.length >= 5;
  res.json({ history, locked });
});

app.post('/correct', async (req, res) => {
  const { name, route, judgePassword } = req.body;

  // 🔐 בדיקת קוד שופט (לא אדמין)
  if (judgePassword !== process.env.JUDGE_PASSWORD) {
    return res.status(403).json({ error: 'קוד שופט שגוי' });
  }

  const routeNum = parseInt(route, 10);

  // איפוס בזיכרון
  if (attemptsMemory[name]) {
    attemptsMemory[name][routeNum] = [];
  }

  // רישום RESET ל-AllAttempts
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: 'AllAttempts!A:F',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[
          name,
          routeNum,
          'RESET',
          '',
          new Date().toLocaleString('he-IL')
        ]],
      },
    });

    console.log(`📝 RESET נרשם ל-AllAttempts עבור ${name}, מסלול ${routeNum}`);
  } catch (err) {
    console.error('❌ שגיאה ברישום RESET:', err.message);
    return res.status(500).json({ error: 'שגיאה ברישום RESET' });
  }

  // ניקוי התא בגיליון Atempts
  try {
    const getNames = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: 'Atempts!B2:B',
    });

    const rowIndex = getNames.data.values.findIndex(row => row[0] === name);
    if (rowIndex !== -1) {
      const excelRow = rowIndex + 2;
      const columnLetter = getExcelColumnName(routeNum + 2);

      await sheets.spreadsheets.values.update({
        spreadsheetId: ACTIVE_SPREADSHEET_ID,
        range: `Atempts!${columnLetter}${excelRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [['']] },
      });
    }
  } catch (err) {
    console.error('❌ שגיאה בניקוי Atempts:', err.message);
    return res.status(500).json({ error: 'שגיאה בניקוי Atempts' });
  }

  res.json({ message: 'הניסיונות אופסו בהצלחה' });
});

app.get('/refresh', async (req, res) => {
  for (const key in attemptsMemory) delete attemptsMemory[key];
  await restoreAttemptsMemory();
  res.json({ message: '✅ שחזור בוצע בהצלחה' });
});

app.post('/mark', async (req, res) => {
  const { name, route, result, stationId } = req.body;
  const routeNum = parseInt(route, 10);
  if (!attemptsMemory[name]) attemptsMemory[name] = {};
  if (!attemptsMemory[name][routeNum]) attemptsMemory[name][routeNum] = [];

  const historyArr = attemptsMemory[name][routeNum];
  if (historyArr.includes('T') || historyArr.length >= 5)
    return res.json({ message: 'Locked', history: historyArr, locked: true });

  historyArr.push(result);
  const attemptNumber = historyArr.length;
  try {
    await ensureAllAttemptsSheet();
    await sheets.spreadsheets.values.append({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: 'AllAttempts!A:F',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[name, routeNum, result, result === 'T' ? attemptNumber : '', new Date().toLocaleString('he-IL'), (typeof stationId !== 'undefined' ? stationId : '')]],
      },
    });

    // הסרה מהתור אחרי סימון ניסיון
    if (queues) {
      for (const id in queues) {
        queues[id] = queues[id].filter(n => n !== name);
      }
      scheduleSaveQueues();
    }

  } catch (err) {
    console.error('❌ שגיאה בכתיבה ל-AllAttempts:', err.message);
    return res.status(500).json({ error: 'בעיה בכתיבה ל-AllAttempts' });
  }

  try {
    await logToAttemptsSheet(name, routeNum, result);
  } catch (err) {
    console.error('❌ שגיאה בעדכון גיליון Atempts:', err.message);
  }

  res.json({ message: 'OK', history: historyArr, locked: result === 'T' || historyArr.length >= 5 });
});

// 📥 הוספת מתחרה לתור לפי UID ותחנה
app.post('/queue/add', async (req, res) => {
  await ensureNFCMapSheet();
  const { uid, stationId } = req.body;
  if (!uid || !stationId) return res.status(400).json({ error: 'חסר UID או מזהה תחנה' });

  try {
    const resGet = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: 'NFCMap!A2:B',
    });
    const rows = resGet.data.values || [];
    const match = rows.find(row => row[0] === uid);

    if (!match) return res.status(404).json({ error: 'UID לא נמצא בגיליון' });

    const name = match[1];

    queues[stationId] = queues[stationId] || [];

    // 🔒 בדיקה גלובלית — האם המתמודד כבר נמצא בתור בתחנה כלשהי
let existingStation = null;
for (const id in queues) {
  if (queues[id].includes(name)) {
    existingStation = id;
    break;
  }
}

// ❌ אם רשום בתחנה אחרת — חסימה
if (existingStation && existingStation !== String(stationId)) {
  return res.status(409).json({
    error: `המתמודד כבר רשום בתחנה ${existingStation}`
  });
}

// 🔁 אם כבר בתור באותה תחנה — הסרה (toggle)
if (queues[stationId].includes(name)) {
  queues[stationId] = queues[stationId].filter(n => n !== name);
scheduleSaveQueues();
return res.json({ message: 'הוסר מהתור', name });
}

// ✅ הוספה חדשה לתור
queues[stationId].push(name);
scheduleSaveQueues();
return res.json({ message: 'התווסף לתור', name });
  } catch (err) {
    console.error('❌ שגיאה בהוספת לתור:', err.message);
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

// ✅ החזרת כל התור לתחנה
app.get('/queue/:stationId/all', (req, res) => {
  const { stationId } = req.params;
  const queue = queues[stationId] || [];
  res.json({ queue });
});

// 📤 הבא בתור בתחנה
app.get('/queue/:stationId', (req, res) => {
  const { stationId } = req.params;
  const queue = queues[stationId] || [];
  const next = queue[0] || null;
  res.json({ next });
});

// 🧹 הסרת מתחרה מהתור (לאחר סיום ניסיון)
app.post('/queue/dequeue', (req, res) => {
  const { stationId } = req.body;
  if (!stationId || !queues[stationId] || queues[stationId].length === 0) {
    return res.status(400).json({ error: 'אין תור להסרה' });
  }
  const removed = queues[stationId].shift();
  scheduleSaveQueues();
  res.json({ removed });
});

// 🧹 ADMIN — איפוס כל התורים (לסיום מקצה)
app.post('/queue/reset-all', (req, res) => {
  const { judgePassword } = req.body || {};

  if (judgePassword !== process.env.JUDGE_PASSWORD) {
    return res.status(403).json({ error: 'קוד שופט שגוי' });
  }

  queues = {};
  queuesPersistenceEnabled = true;

  try {
    fs.mkdirSync(DISK_DIR, { recursive: true });
    fs.writeFileSync(
      QUEUES_FILE,
      JSON.stringify({ sheetId: ACTIVE_SPREADSHEET_ID, queues }, null, 2),
      'utf8'
    );
  } catch (err) {
    console.error('❌ כשל בשמירת reset-all לדיסק:', err.message);
  }

  console.log('🧹 כל התורים אופסו ידנית ע"י שופט');
  res.json({ message: 'כל התורים אופסו בהצלחה' });
});


app.get('/live', async (req, res) => {
  try {
    const [competitorsRes, attemptsRes, assistRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: ACTIVE_SPREADSHEET_ID, range: 'Competitors!B2:H' }),
      sheets.spreadsheets.values.get({ spreadsheetId: ACTIVE_SPREADSHEET_ID, range: 'Atempts!B2:BA' }),
      sheets.spreadsheets.values.get({ spreadsheetId: ACTIVE_SPREADSHEET_ID, range: 'Assist Tables!B2:BA2' }),
    ]);

    const competitorsRows = competitorsRes.data.values || [];
    const attemptsRows = attemptsRes.data.values || [];
    const assistScores = assistRes.data.values?.[0] || [];

    const normalize = str => (str || '').toString().trim();

    const competitors = competitorsRows.map(row => {
      const name = normalize(row[0]);
      const club = normalize(row[6]);
      const category = normalize(row[4]);
      const attemptsRow = attemptsRows.find(r => normalize(r[0]) === name) || [];
      const scores = attemptsRow.slice(1).map((val, i) => {
        const at = parseInt(val);
        const base = parseInt(assistScores[i]);
        if (isNaN(at) || isNaN(base)) return 0;
        return Math.max(0, base - (at - 1) * 10);
      });
      const top = scores.sort((a, b) => b - a).slice(0, 7);
      const total = top.reduce((sum, v) => sum + v, 0);
      return { name, club, category, score: total };
    });

    const grouped = {};
    competitors.forEach(c => {
      grouped[c.category] = grouped[c.category] || [];
      grouped[c.category].push(c);
    });
    Object.values(grouped).forEach(arr => arr.sort((a, b) => b.score - a.score));

    res.json(grouped);
  } catch (err) {
    console.error('❌ שגיאה בנתיב /live:', err.message);
    res.status(500).json({ error: 'שגיאה בחישוב LIVE' });
  }
});

app.get('/personal/:name', async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  try {
    const [attemptsRes, assistRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: ACTIVE_SPREADSHEET_ID, range: 'Atempts!B2:BA' }),
      sheets.spreadsheets.values.get({ spreadsheetId: ACTIVE_SPREADSHEET_ID, range: 'Assist Tables!B2:BA2' }),
    ]);

    const attemptsRows = attemptsRes.data.values || [];
    const assistScores = assistRes.data.values?.[0] || [];

    const row = attemptsRows.find(r => (r[0] || '').trim() === name);
    if (!row) return res.status(404).json({ error: 'לא נמצא מתחרה' });

    const routeAttempts = row.slice(1).map(val => parseInt(val));
    const results = routeAttempts.map((attempts, i) => {
      const baseScore = parseInt(assistScores[i]);
      const score = !isNaN(attempts) && !isNaN(baseScore) ? Math.max(0, baseScore - (attempts - 1) * 10) : 0;
      return {
        route: i + 1,
        attempts: isNaN(attempts) ? null : attempts,
        score: score || 0,
        success: !isNaN(attempts),
      };
    });

    const totalScore = results
      .filter(r => r.success)
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .reduce((sum, r) => sum + r.score, 0);

    res.json({ name, results, totalScore });
  } catch (err) {
    console.error('❌ שגיאה בנתיב /personal:', err.message);
    res.status(500).json({ error: 'שגיאה בשליפת מידע אישי' });
  }
});

app.get('/get-latest-uid', (req, res) => {
  try {
    const uid = fs.readFileSync('latest_uid.txt', 'utf-8').trim();
    res.json({ uid });
  } catch (err) {
    res.status(404).json({ error: 'לא נמצא UID' });
  }
});

// ✅ מציאת שם לפי UID
app.get('/nfc-name/:uid', async (req, res) => {
  const uid = req.params.uid.trim();
  console.log(`🔍 מחפש UID: "${uid}"`);
  
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: 'NFCMap!A2:B',
    });

    const rows = response.data.values || [];
    console.log(`📋 נמצאו ${rows.length} שורות ב-NFCMap`);
    
    const normalizeUid = (str) => (str || '').replace(/[:\s-]/g, '').toLowerCase();
    const uidNormalized = normalizeUid(uid);
    
    const match = rows.find(row => {
      const rowUid = row[0] || '';
      const rowUidNormalized = normalizeUid(rowUid);
      
      if (rowUidNormalized === uidNormalized) {
        console.log(`✅ נמצא התאמה: "${rowUid}" -> "${row[1]}"`);
        return true;
      }
      
      const rowUidNoColon = rowUidNormalized.replace(/:/g, '');
      const uidNoColon = uidNormalized.replace(/:/g, '');
      if (rowUidNoColon === uidNoColon && rowUidNoColon.length > 0) {
        console.log(`✅ נמצא התאמה (ללא נקודתיים): "${rowUid}" -> "${row[1]}"`);
        return true;
      }
      
      return false;
    });

    if (match) {
      res.json({ name: match[1] });
    } else {
      console.log(`❌ לא נמצא התאמה. UID שחיפשו: "${uid}"`);
      console.log(`📋 UIDs שקיימים בגיליון (5 ראשונים):`, rows.slice(0, 5).map(r => r[0]));
      res.status(404).json({ error: 'לא נמצא שם עבור UID הזה' });
    }
  } catch (err) {
    console.error('❌ שגיאה בנתיב /nfc-name:', err.message);
    if (err.code === 403) {
      res.status(403).json({ error: 'אין הרשאה לגיליון. ודא שה-service account מקבל הרשאה לגיליון או שהגיליון פתוח לגישה לכל מי שיש לו את הלינק.' });
    } else {
      res.status(500).json({ error: 'שגיאה בחיפוש UID' });
    }
  }
});

app.get('/search-id/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: 'Competitors!B2:H',
    });
    const rows = sheetRes.data.values || [];
    const match = rows.find(row => row[5] === id); // עמודה G = אינדקס 5
    if (match) {
      const name = match[0];
      const nfcRes = await sheets.spreadsheets.values.get({
        spreadsheetId: ACTIVE_SPREADSHEET_ID,
        range: 'NFCMap!A2:B',
      });
      const nfcRows = nfcRes.data.values || [];
      const nfcMatch = nfcRows.find(row => row[1] === name);
      if (nfcMatch) {
        return res.json({ uid: nfcMatch[0] });
      }
    }
    res.status(404).json({ error: 'לא נמצא' });
  } catch (e) {
    console.error('שגיאה בחיפוש ת.ז:', e.message);
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

// ✅ עדכון מזהה גיליון דרך סיסמת אדמין (ENV + משתנה ריצה)
app.post('/update-sheet-id', (req, res) => {
  const { newSheetId, password } = req.body;

  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'סיסמה שגויה' });
  }

  if (!newSheetId || typeof newSheetId !== 'string') {
    return res.status(400).json({ error: 'מזהה גיליון לא תקין' });
  }

  ACTIVE_SPREADSHEET_ID = newSheetId;
  process.env.ACTIVE_SPREADSHEET_ID = newSheetId;
  resetQueuesForNewSheet();

  saveActiveSheetIdToDisk(ACTIVE_SPREADSHEET_ID);

  console.log(`✅ ACTIVE_SPREADSHEET_ID עודכן ל: ${newSheetId}`);
  console.log('💾 נשמר לדיסק:', ACTIVE_SHEET_FILE);
  res.json({ message: 'מזהה הגיליון עודכן בהצלחה' });
});

// ✅ מחזיר את מזהה הגיליון הפעיל (לבדיקות / דיבוג)
app.get('/get-active-sheet', (req, res) => {
  if (!ACTIVE_SPREADSHEET_ID) {
    return res.status(404).json({ error: 'אין מזהה גיליון פעיל כרגע בשרת הראשי.' });
  }
  res.json({ activeSheetId: ACTIVE_SPREADSHEET_ID });
});

// ✅ עדכון מזהה גיליון דינמי דרך ממשק שופט ראשי
app.post('/set-active-sheet', async (req, res) => {
  const { adminCode, newSheetId } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  console.log('🔍 התקבל adminCode:', adminCode ?? '[ריק]');
  console.log('🧠 ADMIN_PASSWORD מתוך ENV:', ADMIN_PASSWORD ?? '[ריק]');

  if (!ADMIN_PASSWORD || adminCode !== ADMIN_PASSWORD) {
    console.log('❌ קוד מנהל שגוי או לא מוגדר');
    return res.status(403).json({ error: 'קוד מנהל שגוי או לא מוגדר' });
  }

  if (!newSheetId || typeof newSheetId !== 'string') {
    console.log('❌ ID גיליון לא תקין');
    return res.status(400).json({ error: 'ID גיליון לא תקין' });
  }

  ACTIVE_SPREADSHEET_ID = newSheetId;
  process.env.ACTIVE_SPREADSHEET_ID = newSheetId;

  resetQueuesForNewSheet(); // ✅ חובה כדי לאפס תורים בתחרות חדשה

  saveActiveSheetIdToDisk(ACTIVE_SPREADSHEET_ID);
  console.log('📄 ACTIVE_SPREADSHEET_ID עודכן ל:', ACTIVE_SPREADSHEET_ID);
  console.log('💾 נשמר לדיסק:', ACTIVE_SHEET_FILE);

  return res.json({ message: `הגיליון עודכן בהצלחה ל־${newSheetId}` });
});

// ✅ שיוך UID לשם מתחרה – כולל מניעת שיוך כפול
app.post('/assign-nfc', async (req, res) => {
  await ensureNFCMapSheet();
  const { name, uid } = req.body;
  if (!name || !uid) return res.status(400).json({ error: 'Missing name or uid' });

  try {
    const range = 'NFCMap!A2:B';
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range,
    });

    const rows = result.data.values || [];

    const uidRow = rows.find(row => row[0] === uid);
    const nameRow = rows.find(row => row[1] === name);

    if (uidRow && uidRow[1] !== name) {
      return res.status(400).json({ error: 'UID כבר משויך למתחרה אחר' });
    }

    if (nameRow && nameRow[0] !== uid) {
      return res.status(400).json({ error: 'למתחרה כבר משויך UID אחר' });
    }

    if (uidRow && uidRow[1] === name) {
      return res.json({ message: 'כבר קיים שיוך זהה (שם ו־UID)' });
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: 'NFCMap!A:B',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[uid, name]],
      },
    });

    console.log(`✅ שויך UID ${uid} למתחרה ${name}`);
    res.json({ message: 'UID שויך בהצלחה' });
  } catch (err) {
    console.error('❌ שגיאה בשיוך UID:', err.message);
    res.status(500).json({ error: 'שגיאה בשיוך UID' });
  }
});

// 🧱 Serve React build (שים לב: חייב להיות אחרי כל ה-API routes)
const buildPath = path.join(__dirname, 'build');
app.use(express.static(buildPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`✅ השרת רץ על http://localhost:${PORT}`);
   loadQueuesFromDisk();
  try {
    await restoreAttemptsMemory();
    console.log('✅ שיחזור memory הושלם בהצלחה');
   

    // 🔁 רענון Atempts מתוך AllAttempts (פעם ראשונה + כל 2 דקות)
    await reconcileAtemptsFromAllAttempts();
    setInterval(() => {
      reconcileAtemptsFromAllAttempts();
    }, 2 * 60 * 1000);
  } catch (err) {
    console.error('⚠️ שגיאה בשיחזור memory, השרת ממשיך לעבוד:', err.message);
  }
});
