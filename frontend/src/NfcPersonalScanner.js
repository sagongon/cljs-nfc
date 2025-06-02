/* global NDEFReader */
import React, { useEffect, useState } from 'react';

const SERVER_URL = 'https://personalliveresults.onrender.com'; // כתובת השרת שלך

export default function NfcPersonalScanner() {
  const [message, setMessage] = useState('📡 מחכה לצמיד...');
  const [extraInfo, setExtraInfo] = useState('');
  const [scanning, setScanning] = useState(false);
  const [personalData, setPersonalData] = useState(null);

  useEffect(() => {
    const startNfcScan = async () => {
      if (!('NDEFReader' in window)) {
        setMessage('❌ המכשיר שלך לא תומך ב־NFC');
        return;
      }

      try {
        setScanning(true);
        const ndef = new NDEFReader();
        await ndef.scan();
        setMessage('📶 סרוק את הצמיד שלך...');
        setExtraInfo('');

        ndef.onreading = async (event) => {
          const rawUid = event.serialNumber;
          const uid = (rawUid || '').trim().replace(/[^a-zA-Z0-9:]/g, '');
          if (!uid) {
            setMessage('❌ לא זוהה UID');
            return;
          }

          setMessage('🔍 מאתר את הספורטאי לפי UID...');
          setExtraInfo(`UID: ${uid}`);

          try {
            const nameRes = await fetch(`${SERVER_URL}/nfc-name/${uid}`);
            const nameData = await nameRes.json();

            if (!nameRes.ok || !nameData.name) {
              setMessage('❌ UID לא נמצא בגיליון NFCMAP');
              return;
            }

            const name = nameData.name;
            setMessage(`📋 מוצגות התוצאות של ${name}`);

            const personalRes = await fetch(`${SERVER_URL}/personal/${encodeURIComponent(name)}`);
            const personal = await personalRes.json();

            if (!personalRes.ok || personal.error) {
              setMessage('❌ שגיאה בשליפת נתונים');
              return;
            }

            setPersonalData(personal);
          } catch (err) {
            setMessage('❌ שגיאה בשליפת נתונים מהשרת');
            setExtraInfo(`שגיאה: ${err.message}`);
          }
        };
      } catch (err) {
        setMessage('❌ שגיאה בהפעלת סריקה');
        setExtraInfo(`שגיאה כללית: ${err.message}`);
      } finally {
        setScanning(false);
      }
    };

    startNfcScan();
  }, []);

  return (
    <div style={{ padding: 20, direction: 'rtl', textAlign: 'center' }}>
      <h2>📲 צפייה בתוצאות</h2>
      {message && <p style={{ fontSize: 18 }}>{message}</p>}

      {personalData && (
        <div>
          <h3>שם: {personalData.name}</h3>
          <p>ניקוד כולל: {personalData.totalScore}</p>
          <p>מסלולים שהושלמו: {personalData.results.filter(r => r.success).length}/7</p>
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
                <tr key={r.route} style={{ backgroundColor: r.success ? '#e0ffe0' : '#ffe0e0' }}>
                  <td>{r.route}</td>
                  <td>{r.attempts != null ? r.attempts : '-'}</td>
                  <td>{r.score}</td>
                  <td>{r.success ? '✅' : r.attempts ? '❌' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
