
import express from 'express';
import { NFC } from 'nfc-pcsc';
import fs from 'fs';
import cors from 'cors';

const app = express();
const PORT = 9000;
app.use(cors());
app.use(express.json());

const saveUID = (uid) => {
  const payload = {
    uid: uid.match(/.{1,2}/g)?.join(':') || uid,
    ts: Date.now()
  };
  fs.writeFileSync('latest_uid.txt', JSON.stringify(payload), 'utf8');
  console.log(`📥 UID נשמר עם זמן: ${payload.uid}`);
};

const nfc = new NFC();
nfc.on('reader', reader => {
  console.log(`📶 קורא מחובר: ${reader.name}`);
  reader.on('card', card => {
    const uid = card.uid;
    if (uid && uid.length > 2) {
      console.log(`🏷️ UID נלכד: ${uid}`);
      saveUID(uid);
    } else {
      console.warn('⚠️ UID לא תקף');
    }
  });
  reader.on('error', err => console.error('❌ שגיאת קורא:', err));
  reader.on('end', () => console.log(`🔌 הקורא ${reader.name} נותק`));
});
nfc.on('error', err => console.error('שגיאת NFC:', err));

app.get('/get-latest-uid', async (req, res) => {
  try {
    let attempts = 0;
    let payload = null;
    const maxAge = 5000;

    while (attempts < 10) {
      if (fs.existsSync('latest_uid.txt')) {
        const raw = fs.readFileSync('latest_uid.txt', 'utf8').trim();
        if (raw) {
          try {
            const data = JSON.parse(raw);
            const age = Date.now() - data.ts;
            if (data.uid && age <= maxAge) {
              payload = data;
              break;
            }
          } catch {}
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }

    if (!payload) return res.json({ uid: '' });
    fs.writeFileSync('latest_uid.txt', '', 'utf8');
    res.json({ uid: payload.uid });
  } catch (err) {
    console.error('שגיאה בקריאת UID:', err);
    res.status(500).json({ error: 'לא ניתן למשוך UID' });
  }
});

app.listen(PORT, () => {
  console.log(`📲 personal check – רץ על פורט ${PORT}`);
});
