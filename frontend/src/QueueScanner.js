import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'https://cljs.onrender.com';

const QueueScanner = () => {
  const { stationId } = useParams();
  const [message, setMessage] = useState('🔄 טוען...');
  const [isScanning, setIsScanning] = useState(false);

  const startScan = async () => {
    if (!('NDEFReader' in window)) {
      setMessage('❌ המכשיר לא תומך ב־NFC');
      return;
    }

    try {
      const reader = new window.NDEFReader();
      await reader.scan();
      setMessage('⏳ מחכה לצמיד...');
      setIsScanning(true);

      reader.onreading = async (event) => {
        const uid = event.serialNumber;
        setMessage('📡 שולח UID לשרת...');

        try {
          const res = await fetch(`${SERVER_URL}/queue/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, stationId })
          });
          const data = await res.json();

          if (res.ok) {
            setMessage(`✅ ${data.message}`);
          } else {
            setMessage(`❌ ${data.error || 'שגיאה'}`);
          }
        } catch (err) {
          setMessage('❌ שגיאה בשליחת UID');
        } finally {
          setIsScanning(false);
          setTimeout(startScan, 2000); // מנסה שוב אחרי 2 שניות
        }
      };
    } catch (err) {
      console.error(err);
      setMessage('❌ שגיאה בקריאת NFC');
      setIsScanning(false);
    }
  };

  useEffect(() => {
    startScan();
  }, []);

  return (
    <div className="scanner">
      <h2>📶 סריקת צמיד – תחנה {stationId}</h2>
      <p>{message}</p>
    </div>
  );
};

export default QueueScanner;
