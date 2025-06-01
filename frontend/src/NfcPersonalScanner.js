import React, { useEffect, useState } from 'react';

const SERVER_URL = 'https://cljs-nfc.onrender.com'; // כתובת השרת שלך

function NfcPersonalScanner() {
  const [message, setMessage] = useState('📡 מחפש תג NFC...');
  const [personalData, setPersonalData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function scanNFC() {
      try {
        console.log('📡 מתחיל סריקת NFC דרך get-latest-uid...');
        setMessage('📡 סרוק את הצמיד שלך...');
        
        const pollTimeout = 10000;
        const start = Date.now();

        let uid = null;
        while (!uid && Date.now() - start < pollTimeout) {
          const response = await fetch(`${SERVER_URL}/get-latest-uid`);
          const data = await response.json();
          if (data.uid) {
            uid = data.uid;
            console.log('✅ UID זוהה:', uid);
            break;
          }
          await new Promise((res) => setTimeout(res, 500));
        }

        if (!uid) {
          setMessage('⛔ לא זוהה תג NFC. נסה שוב');
          console.warn('⛔ לא התקבל UID לאחר 10 שניות');
          return;
        }

        setMessage('🔍 טוען נתונים...');

        // קריאה לשרת לקבלת שם
        console.log('🔗 פונה לשרת לקבלת שם לפי UID...');
        const nameRes = await fetch(`${SERVER_URL}/nfc-name/${encodeURIComponent(uid)}`);
        const nameData = await nameRes.json();

        if (!nameRes.ok || !nameData.name) {
          setMessage('⛔ שגיאה בשליפת שם מהשרת');
          console.error('⛔ שגיאה בשליפת שם:', nameData);
          return;
        }

        const name = nameData.name;
        console.log('✅ שם שנמצא:', name);

        // שליפת נתונים אישיים
        const personalRes = await fetch(`${SERVER_URL}/personal/${encodeURIComponent(name)}`);
        const personal = await personalRes.json();

        if (!personalRes.ok || personal.error) {
          setMessage('⛔ שגיאה בשליפת נתונים מהשרת');
          console.error('⛔ שגיאה בשליפת נתונים:', personal);
          return;
        }

        console.log('📊 נתונים שהתקבלו:', personal);
        setPersonalData(personal);
        setMessage(null);
      } catch (err) {
        console.error('❌ שגיאה כללית:', err);
        setMessage('❌ שגיאה כללית. נסה שוב מאוחר יותר');
      }
    }

    scanNFC();
  }, []);

  return (
    <div style={{ padding: 20, direction: 'rtl', textAlign: 'center' }}>
      <h2>📲 צפייה בתוצאות</h2>
      {message && <p style={{ fontSize: 18 }}>{message}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {personalData && (
        <div>
          <h3>שם: {personalData.name}</h3>
          <p>ניקוד כולל: {personalData.totalScore}</p>
          <table style={{ margin: 'auto', borderCollapse: 'collapse', width: '90%' }}>
            <thead>
              <tr>
                <th>מסלול</th>
                <th>ניסיונות</th>
                <th>ניקוד</th>
                <th>✔️</th>
              </tr>
            </thead>
            <tbody>
              {personalData.results.map((r) => (
                <tr key={r.route}>
                  <td>{r.route}</td>
                  <td>{r.attempts ?? '-'}</td>
                  <td>{r.score}</td>
                  <td>{r.success ? '✅' : '❌'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default NfcPersonalScanner;
