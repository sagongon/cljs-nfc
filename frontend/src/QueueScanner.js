// QueueScanner.js
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'https://cljs.onrender.com';

const TEST_STATION_ID = '10';

const QueueScanner = () => {
  const { stationId } = useParams();
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const isTestStation = String(stationId) === TEST_STATION_ID;

  const [message, setMessage] = useState('');
  const [queue, setQueue] = useState([]);
  const [reader, setReader] = useState(null);

  const handledBridgeUidRef = useRef(false);

  const fetchWithTimeout = useCallback(async (url, options = {}, timeoutMs = 3500) => {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
        cache: 'no-store',
      });
    } finally {
      clearTimeout(t);
    }
  }, []);

  const fetchQueue = useCallback(async () => {
    if (!stationId) return;
    if (isTestStation) return; // בתחנת בדיקה לא מציגים/טוענים תור

    try {
      const res = await fetch(`${SERVER_URL}/queue/${stationId}/all`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      setQueue(data.queue || []);
    } catch (err) {
      console.error('שגיאה בטעינת התור:', err);
    }
  }, [stationId, isTestStation]);

  const checkUid = useCallback(
    async (uid) => {
      if (!uid) return;

      setMessage('🔎 בודק צמיד...');

      try {
        const res = await fetchWithTimeout(
          `${SERVER_URL}/nfc-name/${encodeURIComponent(uid)}`,
          {},
          3500
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setMessage(`❌ צמיד לא תקין / לא משויך (${data?.error || 'שגיאה'})`);
          return;
        }

        setMessage(`✅ צמיד תקין — משויך ל: ${data?.name || 'לא ידוע'}`);
      } catch (err) {
        setMessage('❌ שגיאת תקשורת בבדיקת צמיד');
      }
    },
    [fetchWithTimeout]
  );

  const addUidToQueue = useCallback(
    async (uid) => {
      if (!uid) return;

      // ✅ תחנת בדיקה: לא מוסיפים לתור, רק בודקים
      if (isTestStation) {
        await checkUid(uid);
        return;
      }

      // ✅ תחנה רגילה: התנהגות רגילה לחלוטין
      setMessage('📡 שולח UID לשרת...');
      try {
        const res = await fetch(`${SERVER_URL}/queue/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid, stationId }),
        });

        const data = await res.json().catch(() => ({}));
        setMessage(res.ok ? `✅ ${data?.message || 'נוסף לתור'}` : `❌ ${data?.error || 'שגיאה'}`);
        fetchQueue();
      } catch {
        setMessage('❌ שגיאה בשליחת UID');
      }
    },
    [stationId, isTestStation, checkUid, fetchQueue]
  );

  // ✅ Bridge hook: ה-WebView יקרא לזה ישירות
  useEffect(() => {
    window.__onBridgeUid = (uid) => {
      addUidToQueue(uid);
    };

    return () => {
      if (window.__onBridgeUid) delete window.__onBridgeUid;
    };
  }, [addUidToQueue]);

  // ✅ טעינת תור כל 3 שניות (רק בתחנות רגילות)
  useEffect(() => {
    fetchQueue();
    if (isTestStation) return;

    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [fetchQueue, isTestStation]);

  // ✅ fallback ?uid=... (אם הדף נטען מחדש)
  useEffect(() => {
    const uidFromBridge = sp.get('uid');
    if (!uidFromBridge) return;
    if (handledBridgeUidRef.current) return;

    handledBridgeUidRef.current = true;
    setMessage('📲 התקבל UID, מעבד...');

    (async () => {
      await addUidToQueue(uidFromBridge);
      navigate(`/queue-scanner/${stationId}`, { replace: true });
      setTimeout(() => {
        handledBridgeUidRef.current = false;
      }, 500);
    })();
  }, [sp, stationId, addUidToQueue, navigate]);

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
        await addUidToQueue(uid);
      };
    } catch (err) {
      console.error('שגיאה בהפעלת הסריקה:', err);
      setMessage('⏳ ממתין לצמיד...');
    }
  }, [addUidToQueue]);

  useEffect(() => {
    if (!reader) startScan();
  }, [reader, startScan]);

  return (
    <div className="scanner" style={{ textAlign: 'center', padding: '20px' }}>
      <h2>
        {isTestStation ? '✅ בדיקת צמידים (תחנת בדיקה)' : `סריקת צמיד – תחנה ${stationId}`}
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