import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'https://cljs.onrender.com';

const QueueScanner = () => {
  const { stationId } = useParams();
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const [message, setMessage] = useState('');
  const [queue, setQueue] = useState([]);
  const [reader, setReader] = useState(null);

  // מונע הוספה כפולה במקרה של רינדור כפול / אפקטים
  const handledBridgeUidRef = useRef(false);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/queue/${stationId}/all`);
      const data = await res.json();
      setQueue(data.queue || []);
    } catch (err) {
      console.error('שגיאה בטעינת התור:', err);
    }
  }, [stationId]);

  // פונקציה מרכזית להוספה לתור (משותפת גם ל-NFC וגם ל-Bridge)
  const addUidToQueue = useCallback(
    async (uid) => {
      if (!uid) return;

      setMessage('📡 שולח UID לשרת...');

      try {
        const res = await fetch(`${SERVER_URL}/queue/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, stationId }),
        });

        const data = await res.json();
        setMessage(res.ok ? `✅ ${data.message}` : `❌ ${data.error || 'שגיאה'}`);
        fetchQueue();
      } catch {
        setMessage('❌ שגיאה בשליחת UID');
      }
    },
    [stationId, fetchQueue]
  );

  // טעינת תור כל 3 שניות
  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // ✅ תמיכה ב-NFCBridge: אם הגיע uid ב-query string, נכניס לתור וננקה URL
  useEffect(() => {
    const uidFromBridge = sp.get('uid');
    if (!uidFromBridge) return;
    if (handledBridgeUidRef.current) return;

    handledBridgeUidRef.current = true;
    setMessage('📲 התקבל UID מה-Bridge, מוסיף לתור...');

    (async () => {
      await addUidToQueue(uidFromBridge);

      // ניקוי uid מהכתובת כדי שלא יתווסף שוב ברענון
      navigate(`/queue-scanner/${stationId}`, { replace: true });

      // מאפשר שוב הוספה בעתיד אם יגיע uid חדש (אחרי ניקוי)
      setTimeout(() => {
        handledBridgeUidRef.current = false;
      }, 500);
    })();
  }, [sp, stationId, addUidToQueue, navigate]);

  const startScan = useCallback(async () => {
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
        await addUidToQueue(uid);
      };
    } catch (err) {
      console.error('שגיאה בהפעלת הסריקה:', err);
      setMessage('❌ שגיאה בקריאת NFC');
    }
  }, [addUidToQueue]);

  useEffect(() => {
    if (!reader) {
      startScan();
    }
  }, [reader, startScan]);

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
