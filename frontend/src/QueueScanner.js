import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'https://cljs.onrender.com';

const QueueScanner = () => {
  const { stationId } = useParams();
  const [message, setMessage] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    console.log('[QueueScanner] component mounted');
    console.log('[QueueScanner] stationId:', stationId);
  }, [stationId]);

  const handleScan = async () => {
    console.log('[QueueScanner] handleScan clicked');

    if (!('NDEFReader' in window)) {
      setMessage('המכשיר לא תומך ב־NFC');
      console.warn('[QueueScanner] NDEFReader not supported');
      return;
    }

    try {
      const reader = new window.NDEFReader();
      await reader.scan();
      setMessage('⏳ מחכה לצמיד...');
      setIsScanning(true);
      console.log('[QueueScanner] NFC scan started');

      reader.onreading = async (event) => {
        console.log('[QueueScanner] NFC tag read:', event);

        const uid = event.serialNumber;
        setMessage('📡 שולח UID לשרת...');
        console.log('[QueueScanner] UID:', uid);

        try {
          const res = await fetch(`${SERVER_URL}/queue/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, stationId })
          });

          const data = await res.json();
          console.log('[QueueScanner] Server response:', data);

          if (res.ok) {
            setMessage(`✅ ${data.message}`);
          } else {
            setMessage(`❌ ${data.error || 'שגיאה'}`);
          }
        } catch (err) {
          console.error('[QueueScanner] שגיאה בשליחת UID:', err);
          setMessage('❌ שגיאה בשליחת UID');
        } finally {
          setIsScanning(false);
        }
      };
    } catch (err) {
      console.error('[QueueScanner] שגיאה כללית בסריקה:', err);
      setMessage('❌ שגיאה בקריאת NFC');
      setIsScanning(false);
    }
  };

  return (
    <div className="scanner">
      <h2>סריקת צמיד – תחנה {stationId}</h2>
      <button onClick={handleScan} disabled={isScanning}>📶 סרוק צמיד</button>
      <p>{message}</p>
    </div>
  );
};

export default QueueScanner;
