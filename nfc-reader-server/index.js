// index.js - שרת Express ל-NFC ב-Render

import express from 'express';
import { NFC } from 'nfc-pcsc';
import fetch from 'node-fetch';
import fs from 'fs';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 9000;

app.use(cors());
app.use(express.json());

let currentName = null;

app.post('/set-name', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  currentName = name;
  res.json({ status: 'ok', name });
});

const sendToSheets = async (uid) => {
  if (!currentName) return console.log('⛔ אין שם מתחרה נבחר');
  try {
    const res = await fetch('https://your-render-server-url.com/api/nfc-map', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: currentName, uid })
    });
    const data = await res.text();
    console.log('✅ נשלח ל-Google Sheets:', data);
  } catch (err) {
    console.error('❌ שגיאה בשליחה לשרת:', err);
  }
};

const nfc = new NFC();
nfc.on('reader', reader => {
  console.log('📶 קורא מחובר:', reader.name);
  reader.autoProcessing = false;

  reader.on('card', async card => {
  const uid = card.uid;
  console.log('🏷️ כרטיס זוהה! UID:', uid);

  // כתיבה לקובץ לשימוש חיצוני (למשל מה-Frontend במחשב)
  fs.writeFileSync('latest_uid.txt', uid);

  sendToSheets(uid);
});


  reader.on('error', err => {
    console.error(`❌ שגיאה בקורא ${reader.name}:`, err);
  });

  reader.on('end', () => {
    console.log(`📴 קורא ${reader.name} נותק`);
  });
});

nfc.on('error', err => {
  console.error('❌ שגיאה כללית ב־NFC:', err);
});

app.listen(port, () => {
  console.log(`🚀 NFC Index server רץ על פורט ${port}`);
});
