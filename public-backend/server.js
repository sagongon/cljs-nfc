// ✅ server.js – גרסה מלאה, מתוקנת, תואמת ESM, עם Google Sheets
import express from 'express';
import cors from 'cors';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dns from 'dns';
import dotenv from 'dotenv';

// טוען משתני סביבה מה־.env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dns.setDefaultResultOrder('ipv4first');
process.env.GOOGLE_API_USE_MTLS_ENDPOINT = 'never';

const app = express();
const PORT = process.env.PORT;

// 🟡 ברירת מחדל ו־ID פעיל של הגיליון
let DEFAULT_SPREADSHEET_ID = process.env.DEFAULT_SPREADSHEET_ID;
let ACTIVE_SPREADSHEET_ID = DEFAULT_SPREADSHEET_ID;

if (!ACTIVE_SPREADSHEET_ID) {
  console.error('❌ לא מוגדר Spreadsheet ID פעיל או ברירת מחדל – הפסקת השרת');
  process.exit(1);
}

// פונקציה שתשתמש תמיד במזהה הנוכחי
function getActiveSheetId() {
  return ACTIVE_SPREADSHEET_ID;
}

app.use(express.json());

// ✅ הגדרות CORS מלאות עם טיפול ב־OPTIONS
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

// ✅ הגדרת אישור גישה ל-Google Sheets לפי הסביבה
let credentials;
let CREDENTIALS_PATH;

if (process.env.GOOGLE_CREDENTIALS_JSON) {
  // מצב ענן (כמו Render)
  credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
} else {
  // מצב מקומי (כמו אצלך ב־localhost)
  CREDENTIALS_PATH = process.env.GOOGLE_SA_PATH;
  credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
}

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
const sheets = google.sheets({ version: 'v4', auth });

const ADMIN_CODE = '007';
const attemptsMemory = {};
const queues = {}; // שמירת תורים לפי stationId

async function ensureNFCMapSheet() {
  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: ACTIVE_SPREADSHEET_ID
 });
  const sheetNames = sheetMeta.data.sheets.map((s) => s.properties.title);
  if (!sheetNames.includes('NFCMap')) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
      requestBody: {
        requests: [{ addSheet: { properties: { title: 'NFCMap' } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
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
  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: ACTIVE_SPREADSHEET_ID
 });
  const sheetNames = sheetMeta.data.sheets.map((s) => s.properties.title);
  if (!sheetNames.includes('AllAttempts')) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
      requestBody: {
        requests: [{ addSheet: { properties: { title: 'AllAttempts' } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
      range: 'AllAttempts!A1:F1',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [['שם מתחרה', 'מסלול', 'תוצאה', 'מספר ניסיון', 'תאריך', 'מספר תחנה']] },
    });
    console.log('🆕 נוצר גיליון AllAttempts');
  }
}

async function restoreAttemptsMemory() {
  console.log('🔄 שיחזור memory מהגיליון AllAttempts...');
  await ensureAllAttemptsSheet();
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
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
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
      range: 'Atempts!B2:B',
    });
    const rowIndex = getNames.data.values.findIndex((row) => row[0] === name);
    if (rowIndex === -1) return;
    const excelRow = rowIndex + 2;
    const columnLetter = getExcelColumnName(parseInt(route, 10) + 2);
    const attemptCount = attemptsMemory[name]?.[parseInt(route, 10)]?.length || '';
    await sheets.spreadsheets.values.update({
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
      range: `Atempts!${columnLetter}${excelRow}`,
      valueInputOption: 'USER_ENTERED',
      resource: { values: [[attemptCount]] },
    });
    console.log(`✅ כתיבה ל-Atempts (${name}, מסלול ${route}, ניסיון ${attemptCount})`);
  } catch (err) {
    console.error('❌ שגיאה בעדכון גיליון Atempts:', err.message);
  }
}

app.post('/sync-offline', async (req, res) => {
  const { attempts } = req.body;
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
        spreadsheetId: ACTIVE_SPREADSHEET_ID
,
        range: 'AllAttempts!A:F',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[name, routeNum, result, result === 'T' ? attemptNumber : '', new Date().toLocaleString('he-IL'), stationId]],
        },
      });
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
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
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
  const { name, route, adminCode } = req.body;
  if (adminCode !== ADMIN_CODE) return res.status(403).json({ error: 'קוד שגוי' });

  const routeNum = parseInt(route, 10);
  if (attemptsMemory[name]) attemptsMemory[name][routeNum] = [];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
      range: 'AllAttempts!A:E',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[name, routeNum, 'RESET', '', new Date().toLocaleString('he-IL')]],
      },
    });
    console.log(`📝 נרשם RESET ל־AllAttempts עבור ${name}, מסלול ${routeNum}`);
  } catch (err) {
    console.error('❌ שגיאה ברישום RESET:', err.message);
  }

  try {
    const getNames = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
      range: 'Atempts!B2:B',
    });
    const rowIndex = getNames.data.values.findIndex((row) => row[0] === name);
    if (rowIndex !== -1) {
      const excelRow = rowIndex + 2;
      const columnLetter = getExcelColumnName(routeNum + 2);
      await sheets.spreadsheets.values.update({
        spreadsheetId: ACTIVE_SPREADSHEET_ID
,
        range: `Atempts!${columnLetter}${excelRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [['']] },
      });
    }
  } catch (err) {
    console.error('❌ שגיאה בניקוי Atempts:', err.message);
  }

  res.json({ message: 'הניסיונות אופסו' });
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
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
      range: 'AllAttempts!A:F',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[name, routeNum, result, result === 'T' ? attemptNumber : '', new Date().toLocaleString('he-IL'), stationId]],
      },
    });

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
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
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

// ✅ בדיקת סטטוס השרת
app.get('/', (req, res) => {
  res.send('🟢 Backend server is running');
});

// ✅ שליפת תוצאות אישיות לפי שם מתחרה
app.get('/personal/:name', async (req, res) => {
  const name = req.params.name.trim();
  try {
    const assistRes = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
      range: 'Assist Tables!B2:AZ2',
    });

    const allAttemptsRes = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
      range: 'AllAttempts!A2:C',
    });

    const assistScores = assistRes.data.values?.[0] || [];
    const allAttemptsRows = allAttemptsRes.data.values || [];

    const attemptHistory = {};
    for (const [rowName, routeStr, result] of allAttemptsRows) {
      if (rowName !== name) continue;
      const route = parseInt(routeStr);
      if (!attemptHistory[route]) attemptHistory[route] = [];
      attemptHistory[route].push(result);
    }

    const results = [];
    for (let route = 1; route <= 52; route++) {
      const baseScore = parseInt(assistScores[route - 1] || '0');
      const fullHistory = attemptHistory[route] || [];

      let lastResetIndex = -1;
      for (let i = fullHistory.length - 1; i >= 0; i--) {
        if (fullHistory[i] === 'RESET') {
          lastResetIndex = i;
          break;
        }
      }

      const activeSeries = fullHistory.slice(lastResetIndex + 1);
      const attemptsOnly = activeSeries.filter(v => v === 'X' || v === 'T');

      const attempts = attemptsOnly.length;
      const success = attemptsOnly.includes('T');
      const score = success ? Math.max(0, baseScore - (attempts - 1) * 10) : 0;

      if (attempts > 0 || success) {
        results.push({ route, attempts, score, success });
      } else {
        results.push({ route, attempts: null, score: 0, success: false });
      }
    }

    const totalScore = results
      .filter((r) => r.success)
      .sort((a, b) => b.score - a.score)
      .slice(0, 7)
      .reduce((sum, r) => sum + r.score, 0);

    res.json({ name, results, totalScore });
  } catch (err) {
    console.error('❌ שגיאה בנתיב /personal:', err.message);
    res.status(500).json({ error: 'שגיאה בשליפת מידע אישי' });
  }
});

// ✅ חיפוש לפי תעודת זהות
app.get('/search-id/:id', async (req, res) => {
  const id = req.params.id.trim();
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
      range: 'Competitors!B2:G',
    });

    const rows = response.data.values || [];
    const match = rows.find(row => (row[5] || '').toString().trim() === id);

    if (match) {
      const name = match[0];
      res.json({ name });
    } else {
      res.status(404).json({ error: 'לא נמצא מתחרה עם תעודת זהות זו' });
    }
  } catch (err) {
    console.error('❌ שגיאה בנתיב /search-id:', err.message);
    res.status(500).json({ error: 'שגיאה בחיפוש תעודת זהות' });
  }
});

// ✅ קריאת UID אחרון מהמחשב
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
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
      range: 'NFCMap!A2:B',
    });

    const rows = response.data.values || [];
    const match = rows.find(row =>
      (row[0] || '').replace(/[:\s]/g, '').toLowerCase() === uid.replace(/[:\s]/g, '').toLowerCase()
    );

    if (match) {
      res.json({ name: match[1] });
    } else {
      res.status(404).json({ error: 'לא נמצא שם עבור UID הזה' });
    }
  } catch (err) {
    console.error('שגיאה בשליפת שם לפי UID:', err);
    res.status(500).json({ error: 'שגיאה בשרת' });
  }
});

// ✅ שיוך UID לשם מתחרה
app.post('/assign-nfc', async (req, res) => {
  await ensureNFCMapSheet();
  const { name, uid } = req.body;
  if (!name || !uid) return res.status(400).json({ error: 'Missing name or uid' });

  try {
    const range = 'NFCMap!A2:B';
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
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
      spreadsheetId: ACTIVE_SPREADSHEET_ID
,
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

// ✅ עדכון מזהה גיליון דינמי דרך ממשק שופט ראשי
app.post('/set-active-sheet', async (req, res) => {
  const { adminCode, newSheetId } = req.body;
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  console.log('🔍 התקבל adminCode:', adminCode ?? '[ריק]');
  console.log('🧠 ADMIN_PASSWORD מתוך ENV:', ADMIN_PASSWORD ? '[קיים]' : '[ריק]');

  if (!ADMIN_PASSWORD || adminCode !== ADMIN_PASSWORD) {
    console.log('❌ קוד מנהל שגוי או לא מוגדר');
    return res.status(403).json({ error: 'קוד מנהל שגוי או לא מוגדר' });
  }

  if (!newSheetId || typeof newSheetId !== 'string') {
    return res.status(400).json({ error: 'ID גיליון לא תקין' });
  }

  // ✅ עדכון המזהה הפעיל בזמן ריצה
  ACTIVE_SPREADSHEET_ID = newSheetId;
  console.log('📄 ACTIVE_SPREADSHEET_ID עודכן ל:', ACTIVE_SPREADSHEET_ID);

  // ✍️ שמירה לקובץ .env
  try {
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    if (envContent.includes('ACTIVE_SPREADSHEET_ID=')) {
      envContent = envContent.replace(/ACTIVE_SPREADSHEET_ID=.*/g, `ACTIVE_SPREADSHEET_ID=${newSheetId}`);
    } else {
      envContent += `\nACTIVE_SPREADSHEET_ID=${newSheetId}`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log(`✅ נשמר לקובץ .env`);
  } catch (err) {
    console.error('❌ שגיאה בשמירה לקובץ .env:', err.message);
  }

  return res.json({ message: `הגיליון עודכן בהצלחה ל־${newSheetId}` });
});


// ✅ הפעלת השרת
app.listen(PORT, async () => {
  console.log(`✅ השרת רץ על http://localhost:${PORT}`);
  await restoreAttemptsMemory();
});
