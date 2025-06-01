/* global NDEFReader */
import React, { useEffect, useState } from 'react';

const SERVER_URL = 'https://cljs-nfc.onrender.com'; // כתובת השרת שלך

export default function NfcPersonalScanner() {
  const [message, setMessage] = useState('📡 מחכה לצמיד...');
  const [extraInfo, setExtraInfo] = useState('');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const startNfcScan = async () => {
      if (!('NDEFReader' in window)) {
        setMessage('❌ המכשיר שלך לא תומך בקריאת NFC בדפדפן');
        return;
      }

      try {
        setScanning(true);
        const ndef = new NDEFReader();
        await ndef.scan();
        setMessage('📶 מחפש תג...');
        setExtraInfo('...');

        ndef.onreading = async (event) => {
          const uid = event.serialNumber;
          if (!uid) {
            setMessage('❌ לא נקלט UID');
            return;
          }

          setMessage('🔄 מחפש שם משויך...');
          setExtraInfo(`UID שנקלט: ${uid}`);

          try {
            const url = `${SERVER_URL}/nfc-name/${uid}`;
            setExtraInfo(prev => prev + `\nURL: ${url}`);
            const response = await fetch(url);
            setExtraInfo(prev => prev + `\nסטטוס תגובה: ${response.status}`);

            const result = await response.json();
            setExtraInfo(prev => prev + `\nתוכן שהתקבל: ${JSON.stringify(result)}`);

            if (response.ok) {
              const encodedName = encodeURIComponent(result.name);
              window.location.href = `/personal/${encodedName}`;
            } else {
              setMessage(`❌ ${result.error}`);
            }
          } catch (err) {
            setMessage('❌ שגיאה בשליפת נתונים מהשרת');
            setExtraInfo(`שגיאה: ${err.message}`);
          }
        };

        ndef.onerror = (err) => {
          setMessage('⚠️ שגיאה בקריאת תג');
          setExtraInfo(`שגיאה ב־ndef.onerror: ${err}`);
        };
      } catch (err) {
        setMessage('❌ שגיאה בהפעלת סריקת NFC');
        setExtraInfo(`שגיאה כללית: ${err.message}`);
      } finally {
        setScanning(false);
      }
    };

    startNfcScan();
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: 30 }}>
      <h2>📲 סרוק את הצמיד שלך</h2>
      <p>{message}</p>
      {extraInfo && (
        <pre
          style={{
            background: '#f0f0f0',
            color: '#333',
            padding: 10,
            borderRadius: 8,
            direction: 'ltr',
            textAlign: 'left',
            marginTop: 20,
            whiteSpace: 'pre-wrap'
          }}
        >
          {extraInfo}
        </pre>
      )}
      {scanning && <p>⏳ ממתין...</p>}
    </div>
  );
}
