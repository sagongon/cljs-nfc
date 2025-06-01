// ✅ index.js – גרסה מלאה עם polling ומחיקת UID לאחר שליחה

import express from 'express';
import { NFC } from 'nfc-pcsc';
import fs from 'fs';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
const PORT = 9000;
app.use(cors());
app.use(express.json());

// שמירת UID אחרון שזוהה
const saveUID = (uid) => {
  const formattedUID = uid.match(/.{1,2}/g)?.join(':') || uid;
fs.writeFileSync('latest_uid.txt', formattedUID, 'utf8');

};

// שליחת UID שנקלט לשרת הראשי
const sendToSheets = async (uid) => {
  try {
    const res = await fetch('http://localhost:4000/register-nfc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid })
    });

    if (!res.ok) throw new Error('שגיאה בשליחת UID לשרת: ' + (await res.text()));

    const text = await res.text();
    console.log(`✅ נשלח לשרת: ${text}`);
  } catch (err) {
    console.error('שגיאה בשליחת UID:', err);
  }
};

// התחברות לקורא NFC
const nfc = new NFC();
nfc.on('reader', reader => {
  console.log(`📶 קורא מחובר: ${reader.name}`);

  reader.on('card', card => {
    const uid = card.uid;
    if (uid && uid.length > 2) {
      console.log(`🏷️ UID נלכד: ${uid}`);
      saveUID(uid);
      sendToSheets(uid);
    } else {
      console.warn('⚠️ כרטיס זוהה אך UID ריק או לא תקף');
    }
  });

  reader.on('error', err => {
    console.error(`❌ שגיאת קורא:`, err);
  });

  reader.on('end', () => {
    console.log(`🔌 הקורא ${reader.name} נותק`);
  });
});

nfc.on('error', err => {
  console.error('שגיאת NFC:', err);
});

// 🟢 קריאת UID לבקשת האפליקציה
app.get('/get-latest-uid', async (req, res) => {
  try {
    let attempts = 0;
    let uid = '';

    // ניסיון לקרוא UID כל חצי שנייה עד 5 שניות (10 ניסיונות)
    while (attempts < 10) {
      uid = fs.existsSync('latest_uid.txt') ? fs.readFileSync('latest_uid.txt', 'utf8').trim() : '';
      if (uid) break;
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    if (!uid) return res.json({ uid: '' });

    // מחיקת UID לאחר שליחה
    fs.writeFileSync('latest_uid.txt', '', 'utf8');
    res.json({ uid });
  } catch (err) {
    console.error('שגיאה בקריאת UID:', err);
    res.status(500).json({ error: 'לא ניתן למשוך UID' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 NFC Index server רץ על פורט ${PORT}`);
});
