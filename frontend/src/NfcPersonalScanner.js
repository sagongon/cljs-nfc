/* global NDEFReader */
import React, { useEffect, useState } from 'react';

const SERVER_URL = 'https://cljs-nfc.onrender.com'; // כתובת השרת שלך

export default function NfcPersonalScanner() {
  const [message, setMessage] = useState('📡 מחכה לצמיד...');
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

        ndef.onreading = async (event) => {
          const uid = event.serialNumber;
          if (!uid) {
            setMessage('❌ לא נקלט UID');
            return;
          }

          setMessage('🔄 מחפש שם משויך...');
          try {
            const response = await fetch(`${SERVER_URL}/nfc-name/${uid}`);
            const result = await response.json();

            if (response.ok) {
              const encodedName = encodeURIComponent(result.name);
              window.location.href = `/personal/${encodedName}`;
            } else {
              setMessage(`❌ ${result.error}`);
            }
          } catch (err) {
            setMessage('❌ שגיאה בשליפת נתונים מהשרת');
            console.error(err);
          }
        };

        ndef.onerror = (err) => {
          setMessage('⚠️ שגיאה בקריאת תג');
          console.error(err);
        };
      } catch (err) {
        console.error(err);
        setMessage('❌ שגיאה בהפעלת סריקת NFC');
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
      {scanning && <p>⏳ ממתין...</p>}
    </div>
  );
}
