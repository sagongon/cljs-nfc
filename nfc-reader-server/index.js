// index.js - קריאת UID מהקורא
const { NFC } = require('nfc-pcsc');

const nfc = new NFC(); // יצירת מופע NFC

nfc.on('reader', reader => {
  console.log(`📶 קורא מחובר: ${reader.reader.name}`);

  reader.on('card', card => {
    console.log(`🏷️ כרטיס זוהה! UID: ${card.uid}`);

    const fs = require('fs');
    const fetch = require('node-fetch');
    const currentNameFile = 'current_name.txt';

    if (fs.existsSync(currentNameFile)) {
      const name = fs.readFileSync(currentNameFile, 'utf-8').trim();
      if (name) {
        console.log(`📨 שולח UID עבור ${name} לשרת...`);
        fetch('http://localhost:4000/assign-nfc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, uid: card.uid })
        })
        .then(res => res.json())
        .then(data => {
          console.log(`✅ תשובת שרת: ${data.message || 'בוצע בהצלחה'}`);
        })
        .catch(err => {
          console.error('❌ שגיאה בשליחת UID לשרת:', err);
        });

        // ננקה את הקובץ לאחר השליחה
        fs.unlinkSync(currentNameFile);
      } else {
        console.warn('⚠️ קובץ current_name.txt ריק');
      }
    } else {
      console.warn('⚠️ קובץ current_name.txt לא נמצא - יש לשלוח את שם המתחרה מה-Frontend');
    }
  });

  reader.on('error', err => {
    console.error(`❌ שגיאה בקורא ${reader.reader.name}:`, err);
  });

  reader.on('end', () => {
    console.log(`🔌 הקורא ${reader.reader.name} התנתק.`);
  });
});

nfc.on('error', err => {
  console.error('שגיאה כללית ב־NFC:', err);
});
