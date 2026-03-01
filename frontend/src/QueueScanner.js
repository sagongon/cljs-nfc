import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'https://cljs.onrender.com';

// תחנת בדיקת צמידים (לא תור)
const CHECK_STATION_ID = '10';

const QueueScanner = () => {
  const { stationId } = useParams();
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const isCheckStation = String(stationId) === CHECK_STATION_ID;

  const [message, setMessage] = useState('');
  const [queue, setQueue] = useState([]);
  const [reader, setReader] = useState(null);

  const handledBridgeUidRef = useRef(false);

  const fetchQueue = useCallback(async () => {
    if (isCheckStation) return; // תחנת בדיקה לא מציגה תור
    try {
      const res = await fetch(`${SERVER_URL}/queue/${stationId}/all`);
      const data = await res.json().catch(() => ({}));
      setQueue(data.queue || []);
    } catch (err) {
      console.error('שגיאה בטעינת התור:', err);
    }
  }, [stationId, isCheckStation]);

  // ---------- מצב בדיקה ----------
  const checkUid = useCallback(
    async (uid) => {
      const cleanUid = (uid || '').toString().trim();
      if (!cleanUid) return;

      setMessage('🔎 בודק שיוך צמיד...');
      try {
        const res = await fetch(`${SERVER_URL}/nfc-name/${encodeURIComponent(cleanUid)}`, {
          method: 'GET',
          cache: 'no-store',
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setMessage(`❌ שגיאה בבדיקה (${res.status})`);
          return;
        }

        const name = (data?.name || '').toString().trim();

        if (name) setMessage(`✅ צמיד תקין — משויך ל: ${name}`);
        else setMessage('❌ צמיד לא משויך / לא תקין');
      } catch (e) {
        console.error('checkUid failed:', e);
        setMessage('❌ שגיאת תקשורת בבדיקת צמיד');
      }
    },
    [SERVER_URL]
  );

  // ---------- מצב תור רגיל ----------
  const addUidToQueue = useCallback(
    async (uid) => {
      const cleanUid = (uid || '').toString().trim();
      if (!cleanUid) return;

      setMessage('📡 שולח UID לשרת...');
      try {
        const res = await fetch(`${SERVER_URL}/queue/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: cleanUid, stationId }),
        });

        const data = await res.json().catch(() => ({}));
        setMessage(res.ok ? `✅ ${data.message || 'נוסף לתור'}` : `❌ ${data.error || 'שגיאה'}`);
        fetchQueue();
      } catch {
        setMessage('❌ שגיאה בשליחת UID');
      }
    },
    [stationId, fetchQueue]
  );

  // נקודת כניסה אחת ל-UID (גם NFC וגם Bridge)
  const handleUid = useCallback(
    async (uid) => {
      if (isCheckStation) return checkUid(uid);
      return addUidToQueue(uid);
    },
    [isCheckStation, checkUid, addUidToQueue]
  );

  // ✅ Bridge hook: ה-WebView יקרא לזה ישירות
  useEffect(() => {
    window.__onBridgeUid = (uid) => {
      handleUid(uid);
    };

    return () => {
      if (window.__onBridgeUid) delete window.__onBridgeUid;
    };
  }, [handleUid]);

  // polling לתור כל 3 שניות (רק בתחנות רגילות)
  useEffect(() => {
    if (isCheckStation) return;
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [fetchQueue, isCheckStation]);

  // תמיכה גם ב-?uid=... (fallback אם הדף נטען מחדש)
  useEffect(() => {
    const uidFromBridge = sp.get('uid');
    if (!uidFromBridge) return;
    if (handledBridgeUidRef.current) return;

    handledBridgeUidRef.current = true;

    setMessage(isCheckStation ? '📲 התקבל UID מה-Bridge, בודק שיוך...' : '📲 התקבל UID מה-Bridge, מוסיף לתור...');

    (async () => {
      await handleUid(uidFromBridge);
      navigate(`/queue-scanner/${stationId}`, { replace: true });
      setTimeout(() => {
        handledBridgeUidRef.current = false;
      }, 500);
    })();
  }, [sp, stationId, handleUid, navigate, isCheckStation]);

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
        await handleUid(uid);
      };
    } catch (err) {
      console.error('שגיאה בהפעלת הסריקה:', err);
      setMessage('⏳ ממתין לצמיד...');
    }
  }, [handleUid]);

  useEffect(() => {
    if (!reader) startScan();
  }, [reader, startScan]);

  return (
    <div className="scanner" style={{ textAlign: 'center', padding: '20px' }}>
      <h2>
        {isCheckStation ? 'בדיקת צמידים' : 'סריקת צמיד'} – תחנה {stationId}
      </h2>
      <p>{message}</p>

      {!isCheckStation && (
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