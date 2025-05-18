import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'https://cljs.onrender.com';

const QueueScanner = () => {
  const { stationId } = useParams();
  const [message, setMessage] = useState('');
  const [queue, setQueue] = useState([]);
  const [reader, setReader] = useState(null);

  const fetchQueue = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/queue/${stationId}/all`);
      const data = await res.json();
      setQueue(data.queue || []);
    } catch (err) {
      console.error('שגיאה בטעינת התור:', err);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [stationId]);

  const startScan = async () => {
    if (!('NDEFReader' in window)) {
      setMessage('המכשיר לא תומך ב־NFC');
      return;
    }

    try {
      const nfcReader = new window.NDEFReader();
      await nfcReader.scan();
      setReader(nfcReader);
      setMessage('⏳ ממתין לצמיד...');

      nfcReader.onreading = async (event) => {
        const uid = event.serialNumber;
        setMessage('📡 שולח UID לשרת...');

        try {
          const res = await fetch(`${SERVER_URL}/queue/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, stationId })
          });

          const data = await res.json();
          setMessage(res.ok ? `✅ ${data.message}` : `❌ ${data.error || 'שגיאה'}`);
          fetchQueue();
        } catch {
          setMessage('❌ שגיאה בשליחת UID');
        }
      };
    } catch (err) {
      console.error('שגיאה בהפעלת הסריקה:', err);
      setMessage('❌ שגיאה בקריאת NFC');
    }
  };

  // הפעלת סריקה אוטומטית
  useEffect(() => {
    if (!reader) {
      startScan();
    }
  }, [reader]);

  return (
    <div className="scanner" style={{ textAlign: 'center', padding: '20px' }}>
      <h2>סריקת צמיד – תחנה {stationId}</h2>
      <p>{message}</p>

      <h3>🕓 ממתינים בתור:</h3>
      {queue.length === 0 ? (
        <p>אין ממתינים כרגע</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {queue.map((name, idx) => (
            <li key={idx}>{idx + 1}. {name}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default QueueScanner;
