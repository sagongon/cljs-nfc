import React, { useEffect, useState } from 'react';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

export default function NfcPersonalScanner() {
  const [message, setMessage] = useState('📡 מחכה לצמיד...');
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    const scanNFC = async () => {
      try {
        setScanning(true);
        const res = await fetch('http://localhost:9000/get-latest-uid');
        const data = await res.json();
        const uid = data.uid;
        if (!uid) throw new Error('לא נמשה UID');

        setMessage('🔄 מחפש שם משויך...');
        const response = await fetch(`${SERVER_URL}/nfc-name/${uid}`);
        const result = await response.json();

        if (response.ok) {
          const encodedName = encodeURIComponent(result.name);
          window.location.href = `/personal/${encodedName}`;
        } else {
          setMessage(`❌ ${result.error}`);
        }
      } catch (err) {
        console.error(err);
        setMessage('❌ שגיאה בקריאת UID או בשליפת שם');
      } finally {
        setScanning(false);
      }
    };

    scanNFC();
  }, []);

  return (
    <div style={{ textAlign: 'center', padding: 30 }}>
      <h2>📲 סרוק את הצמיד שלך</h2>
      <p>{message}</p>
      {scanning && <p>⏳ ממתין...</p>}
    </div>
  );
}
