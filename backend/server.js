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

dns.setDefaultResultOrder('ipv4first');
process.env.GOOGLE_API_USE_MTLS_ENDPOINT = 'never';

const app = express();

// ✅ הגדרות CORS מלאות עם טיפול מפורש ב-OPTIONS
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = ['https://cljs-nfc-ashy.vercel.app'];

  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
  }
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

console.log('✅ CORS מוגדר');

app.use(express.json());

// ✅ Health check endpoint - מונע השעיה ב-Render
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((req, res, next) => {
  console.log(`📥 בקשה מ: ${req.headers.origin} לנתיב ${req.url}`);
  next();
});

const PORT = process.env.PORT || 4000;

// 🟡 ברירת מחדל + מזהה פעיל (מתוך ENV אם קיים)
let DEFAULT_SPREADSHEET_ID = process.env.DEFAULT_SPREADSHEET_ID || '';
let ACTIVE_SPREADSHEET_ID =
  process.env.ACTIVE_SPREADSHEET_ID || DEFAULT_SPREADSHEET_ID;

console.log("📄 DEFAULT_SPREADSHEET_ID:", DEFAULT_SPREADSHEET_ID || "[לא מוגדר]");
console.log("📄 ACTIVE_SPREADSHEET_ID בתחילת טעינה:", ACTIVE_SPREADSHEET_ID || "[לא מוגדר]");

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
const queues = {}; // תורים לפי תחנה

// ✅ מנגנון "יישור קו" אוטומטי Atempts מתוך AllAttempts
let attemptsDirty = false;
let rebuildLock = false;
let lastRebuildAt = null;

function markDirty(reason = '') {
  attemptsDirty = true;
  if (reason) console.log(`🟠 attemptsDirty=true (${reason})`);
}

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
      range: 'AllAttempts!A2:F',
    });
    const rows = res.data.values || [];
    const tempMemory = {};
    for (const [name, routeStr, result] of rows) {
      const route = parseInt(routeStr, 10);
      if (!name || isNaN(route)) continue;

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
    const rowIndex = (getNames.data.values || []).findIndex((row) => row[0] === name);
    if (rowIndex === -1) return;

    const excelRow = rowIndex + 2;
    const columnLetter = getExcelColumnName(parseInt(route, 10) + 2); // route 1 -> col C
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

/**
 * ✅ Rebuild מלא של Atempts מתוך AllAttempts (כרונולוגי)
 * - RESET מאפס ספירה
 * - סופרים X/T מאז ה-RESET האחרון
 * - אם יש T -> כותבים מספר ניסיונות עד ההצלחה
 * - אם אין T -> התא נשאר ריק
 *
 * כתיבה ב-batch לטווח C2:BA{N}
 */
async function rebuildAtemptsFromAllAttempts() {
  if (rebuildLock) return;
  rebuildLock = true;

  const startedAt = new Date();
  console.log(`🔁 rebuildAtemptsFromAllAttempts התחיל... ${startedAt.toLocaleString('he-IL')}`);

  try {
    await ensureAllAttemptsSheet();

    // 1) קריאת AllAttempts
    const allRes = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: 'AllAttempts!A2:F',
    });
    const allRows = allRes.data.values || [];

    // 2) קריאת רשימת מתחרים מתוך Atempts (שורה לפי שם)
    const namesRes = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: 'Atempts!B2:B',
    });
    const names = (namesRes.data.values || []).map(r => (r[0] || '').trim());
    const nameToRowIndex = new Map();
    names.forEach((n, i) => {
      if (n) nameToRowIndex.set(n, i); // i = 0-based (B2 = 0)
    });

    // 3) להבין כמה מסלולים יש לפי כותרות (C1:BA1)
    const headerRes = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: 'Atempts!C1:BA1',
    });
    const header = (headerRes.data.values?.[0] || []).map(x => (x || '').toString().trim());
    const routeNumbers = header
      .map(v => parseInt(v, 10))
      .filter(v => !isNaN(v) && v > 0);

    // fallback אם הכותרות לא מספריות (לא אמור לקרות אצלך)
    const maxRoutes = routeNumbers.length > 0 ? Math.max(...routeNumbers) : header.length;

    // 4) חישוב מצב סופי: name -> route -> attemptCount (או null)
    // state: מאז ה-RESET האחרון
    const state = {}; // state[name][route] = { count, locked }
    const finalAttempts = {}; // finalAttempts[name][route] = number (אחרי T) או null

    const getBucket = (name, route) => {
      if (!state[name]) state[name] = {};
      if (!state[name][route]) state[name][route] = { count: 0, locked: false };
      return state[name][route];
    };

    for (const row of allRows) {
      const name = (row[0] || '').toString().trim();
      const routeNum = parseInt(row[1], 10);
      const result = (row[2] || '').toString().trim();

      if (!name || isNaN(routeNum) || routeNum <= 0) continue;
      if (!['X', 'T', 'RESET'].includes(result)) continue;

      const b = getBucket(name, routeNum);

      if (result === 'RESET') {
        b.count = 0;
        b.locked = false;
        if (!finalAttempts[name]) finalAttempts[name] = {};
        finalAttempts[name][routeNum] = null;
        continue;
      }

      if (b.locked) continue; // אחרי T מתעלמים מכל מה שבא

      if (result === 'X') {
        b.count += 1;
        // לא כותבים ל-final עד שיש T
      } else if (result === 'T') {
        b.count += 1;
        b.locked = true;
        if (!finalAttempts[name]) finalAttempts[name] = {};
        finalAttempts[name][routeNum] = b.count;
      }
    }

    // 5) בניית מטריצה לעדכון: rows = מספר מתחרים, cols = מסלולים (C..BA)
    // אצלך: route 1 -> col C = index 0
    const colsCount = header.length; // C..BA
    const matrix = Array.from({ length: names.length }, () => Array.from({ length: colsCount }, () => ''));

    for (const [name, routeMap] of Object.entries(finalAttempts)) {
      const rowIdx = nameToRowIndex.get(name);
      if (rowIdx === undefined) continue;

      for (const [routeStr, attemptCount] of Object.entries(routeMap)) {
        const r = parseInt(routeStr, 10);
        if (isNaN(r) || r <= 0) continue;

        // route 1 -> column C (index 0)
        const colIdx = r - 1;
        if (colIdx < 0 || colIdx >= colsCount) continue;

        matrix[rowIdx][colIdx] = attemptCount ? attemptCount : '';
      }
    }

    // 6) כתיבה ב-batch
    const lastRow = names.length + 1; // כי מתחיל ב-2, שורה 1 כותרת
    if (names.length > 0 && colsCount > 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: ACTIVE_SPREADSHEET_ID,
        range: `Atempts!C2:${getExcelColumnName(2 + colsCount)}${lastRow}`, // 2 = B, אז 2+colsCount = B + N -> עד BA
        valueInputOption: 'USER_ENTERED',
        resource: { values: matrix },
      });
    }

    // 7) (אופציונלי) לרענן את attemptsMemory מהלוג לאחר rebuild
    for (const key in attemptsMemory) delete attemptsMemory[key];
    await restoreAttemptsMemory();

    lastRebuildAt = new Date();
    console.log(`✅ rebuild הושלם בהצלחה (${lastRebuildAt.toLocaleString('he-IL')})`);
  } catch (err) {
    console.error('❌ rebuildAtemptsFromAllAttempts נכשל:', err.message);
    throw err;
  } finally {
    rebuildLock = false;
  }
}

app.post('/sync-offline', async (req, res) => {
  const { attempts, stationId: stationIdFromBody } = req.body;
  if (!Array.isArray(attempts)) return res.status(400).json({ error: 'invalid format' });

  const results = [];
  for (const { name, route, result, stationId } of attempts) {
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
            stationId ?? stationIdFromBody ?? ''
          ]],
        },
      });

      markDirty('sync-offline append');
      await logToAttemptsSheet(name, routeNum, result);

      results.push({ name, route, result, saved: true });
    } catch (err) {
      console.error('❌ שגיאה בסנכרון אופליין:', err.message);
      results.push({ name, route, result, error: true });
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
  const { name, route, judgePassword, stationId } = req.body;

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
    await ensureAllAttemptsSheet();
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
          new Date().toLocaleString('he-IL'),
          stationId ?? ''
        ]],
      },
    });

    markDirty('correct RESET append');
    console.log(`📝 RESET נרשם ל-AllAttempts עבור ${name}, מסלול ${routeNum}`);
  } catch (err) {
    console.error('❌ שגיאה ברישום RESET:', err.message);
    return res.status(500).json({ error: 'שגיאה ברישום RESET' });
  }

  // ניקוי התא בגיליון Atempts (מיידי) – יישור קו מלא יקרה ברוטינה
  try {
    const getNames = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID,
      range: 'Atempts!B2:B',
    });

    const rowIndex = (getNames.data.values || []).findIndex(row => row[0] === name);
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
        values: [[
          name,
          routeNum,
          result,
          result === 'T' ? attemptNumber : '',
          new Date().toLocaleString('he-IL'),
          stationId ?? ''
        ]],
      },
    });

    markDirty('mark append');

    // הסרה מהתור אחרי סימון ניסיון
    if (queues) {
      for (const id in queues) {
        queues[id] = queues[id].filter(n => n !== name);
      }
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

    // אם כבר בתור – הסרה (כדי לאפשר ביטול תור)
    if (queues[stationId].includes(name)) {
      queues[stationId] = queues[stationId].filter(n => n !== name);
      return res.json({ message: 'הוסר מהתור', name });
    }

    // הוספה חדשה לתור
    queues[stationId].push(name);
    res.json({ message: 'התווסף לתור', name });
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
  res.json({ removed });
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

  console.log(`✅ ACTIVE_SPREADSHEET_ID עודכן ל: ${newSheetId}`);
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
  console.log('📄 ACTIVE_SPREADSHEET_ID עודכן ל:', ACTIVE_SPREADSHEET_ID);

  // שינוי גיליון -> עדיף rebuild מלא ברקע
  markDirty('set-active-sheet');
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

// ✅ Static צריך להיות אחרי כל ה-API, אחרת הוא "תופס" הכל
const buildPath = path.join(__dirname, 'build');
app.use(express.static(buildPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`✅ השרת רץ על http://localhost:${PORT}`);
  try {
    await restoreAttemptsMemory();
    console.log('✅ שיחזור memory הושלם בהצלחה');
  } catch (err) {
    console.error('⚠️ שגיאה בשיחזור memory, השרת ממשיך לעבוד:', err.message);
  }

  // ✅ רוטינה כל 2 דקות: rebuild רק אם dirty
  setInterval(async () => {
    if (!attemptsDirty) return;
    if (rebuildLock) return;

    try {
      console.log('⏱️ רוטינה: זוהה dirty -> מתחיל rebuild...');
      await rebuildAtemptsFromAllAttempts();
      attemptsDirty = false;
      console.log('✅ רוטינה: rebuild הסתיים, dirty=false');
    } catch (e) {
      console.error('❌ רוטינה: rebuild נכשל:', e.message);
      // נשאר dirty=true כדי לנסות שוב בריצה הבאה
    }
  }, 2 * 60 * 1000);
});
