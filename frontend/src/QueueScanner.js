import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'https://cljs.onrender.com';

// תחנת בדיקה (לא מכניסה לתור)
const TEST_STATION_ID = '10';

const QueueScanner = () => {
  const { stationId } = useParams();
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const [message, setMessage] = useState('');
  const [queue, setQueue] = useState([]);
  const [reader, setReader] = useState(null);

  const handledBridgeUidRef = useRef(false);

  const isTestStation = String(stationId).trim() === TEST_STATION_ID;

  const fetchQueue = useCallback(async () => {
    // בתחנת בדיקה לא צריך תור
    if (isTestStation) return;

    try {
      const res = await fetch(`${SERVER_URL}/queue/${stationId}/all`);
      const data = await res.json();
      setQueue(data.queue || []);
    } catch (err) {
      console.error('שגיאה בטעינת התור:', err);
    }
  }, [stationId, isTestStation]);

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

        const data = await res.json().catch(() => ({}));
        setMessage(res.ok ? `✅ ${data.message}` : `❌ ${data.error || 'שגיאה'}`);
        fetchQueue();
      } catch {
        setMessage('❌ שגיאה בשליחת UID');
      }
    },
    [stationId, fetchQueue]
  );

  // בדיקת UID בלבד (לתחנת בדיקה)
  const lookupUidOnly = useCallback(async (uid) => {
    if (!uid) return;

    setMessage('🔎 בודק שיוך צמיד...');
    try {
      const res = await fetch(`${SERVER_URL}/nfc/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(`❌ ${data.error || 'שגיאה בבדיקת צמיד'}`);
        return;
      }

      const name = (data?.name || '').toString().trim();
      if (!name) {
        setMessage('❌ צמיד לא משויך');
        return;
      }

      setMessage(`✅ צמיד תקין — משויך ל: ${name}`);
    } catch {
      setMessage('❌ שגיאת תקשורת לשרת');
    }
  }, []);

  // ✅ Bridge hook: ה-WebView יקרא לזה ישירות בלי לעבור מסך
  useEffect(() => {
    window.__onBridgeUid = (uid) => {
      if (isTestStation) lookupUidOnly(uid);
      else addUidToQueue(uid);
    };

    return () => {
      if (window.__onBridgeUid) delete window.__onBridgeUid;
    };
  }, [addUidToQueue, lookupUidOnly, isTestStation]);

  // טעינת תור כל 3 שניות (רק תחנה רגילה)
  useEffect(() => {
    if (isTestStation) return;

    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [fetchQueue, isTestStation]);

  // תמיכה גם ב-?uid=... (fallback אם הדף נטען מחדש)
  useEffect(() => {
    const uidFromBridge = sp.get('uid');
    if (!uidFromBridge) return;
    if (handledBridgeUidRef.current) return;

    handledBridgeUidRef.current = true;

    if (isTestStation) {
      setMessage('📲 התקבל UID מה-Bridge, בודק שיוך...');
      (async () => {
        await lookupUidOnly(uidFromBridge);
        navigate(`/queue-scanner/${stationId}`, { replace: true });
        setTimeout(() => {
          handledBridgeUidRef.current = false;
        }, 500);
      })();
      return;
    }

    setMessage('📲 התקבל UID מה-Bridge, מוסיף לתור...');
    (async () => {
      await addUidToQueue(uidFromBridge);
      navigate(`/queue-scanner/${stationId}`, { replace: true });
      setTimeout(() => {
        handledBridgeUidRef.current = false;
      }, 500);
    })();
  }, [sp, stationId, addUidToQueue, lookupUidOnly, navigate, isTestStation]);

  const startScan = useCallback(async () => {
    if (!('NDEFReader' in window)) {
      // בסמסונג זה בסדר — ה-Bridge יזרים UID
      setMessage('⏳ ממתין לצמיד...');
      return;
    }

    try {
      const nfcReader = new window.NDEFReader();
      await nfcReader.scan();
      setReader(nfcReader);
      setMessage('⏳ ממתין לצמיד...');

      nfcReader.onreading = async (event) => {
        const uid = event.serialNumber;
        if (isTestStation) await lookupUidOnly(uid);
        else await addUidToQueue(uid);
      };
    } catch (err) {
      console.error('שגיאה בהפעלת הסריקה:', err);
      setMessage('⏳ ממתין לצמיד...');
    }
  }, [addUidToQueue, lookupUidOnly, isTestStation]);

  useEffect(() => {
    if (!reader) startScan();
  }, [reader, startScan]);

  return (
    <div className="scanner" style={{ textAlign: 'center', padding: '20px' }}>
      <h2>
        {isTestStation ? 'בדיקת צמידים' : 'סריקת צמיד'} – תחנה {stationId}
      </h2>

      <p>{message}</p>

      {!isTestStation && (
        <>
          <h3>🕓 ממתינים בתור:</h3>
          {queue.length === 0 ? (
            <p>אין ממתינים כרגע</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {queue.map((name, idx) => (
                <li key={idx}>
                  {idx + 1}. {name}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};

export default QueueScanner;