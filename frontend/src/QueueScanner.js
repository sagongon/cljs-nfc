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

  // 🔊 simple beep (no assets needed)
  const beep = useCallback((type = 'ok') => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();

      o.type = 'sine';
      // OK = higher, ERR = lower
      o.frequency.value = type === 'ok' ? 880 : 220;

      // short + gentle
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);

      o.connect(g);
      g.connect(ctx.destination);

      o.start();
      o.stop(ctx.currentTime + 0.2);

      // cleanup
      o.onended = () => {
        try {
          ctx.close();
        } catch {}
      };
    } catch {
      // ignore sound failures
    }
  }, []);

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

      const clearAfterMs = 3500;

      try {
        const res = await fetchWithTimeout(
          `${SERVER_URL}/nfc-name/${encodeURIComponent(uid)}`,
          {},
          3500
        );

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          setMessage(`❌ צמיד לא תקין / לא משויך (${data?.error || 'שגיאה'})`);
          beep('err');

          setTimeout(() => {
            setMessage('⏳ ממתין לצמיד...');
          }, clearAfterMs);

          return;
        }

        setMessage(`✅ צמיד תקין — משויך ל: ${data?.name || 'לא ידוע'}`);
        beep('ok');

        setTimeout(() => {
          setMessage('⏳ ממתין לצמיד...');
        }, clearAfterMs);
      } catch (err) {
        setMessage('❌ שגיאת תקשורת בבדיקת צמיד');
        beep('err');

        setTimeout(() => {
          setMessage('⏳ ממתין לצמיד...');
        }, clearAfterMs);
      }
    },
    [fetchWithTimeout, beep]
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