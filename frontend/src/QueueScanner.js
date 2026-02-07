import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'https://cljs.onrender.com';

const BRIDGE_URL = 'http://localhost:9000/get-latest-uid';
const BRIDGE_POLL_MS = 300;

const normalizeUid = (raw) => (raw || '').toString().trim();

const QueueScanner = () => {
  const { stationId } = useParams();

  const [message, setMessage] = useState('📳 מפעיל Web NFC…');
  const [queue, setQueue] = useState([]);
  const [mode, setMode] = useState('webnfc'); // webnfc | bridge
  const [lastSource, setLastSource] = useState('');

  const lastProcessedUidRef = useRef('');
  const isSendingRef = useRef(false);

  const bridgeActiveRef = useRef(false);
  const bridgeStartedRef = useRef(false);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch(`${SERVER_URL}/queue/${stationId}/all`);
      const data = await res.json();
      setQueue(data.queue || []);
    } catch (err) {
      console.error('שגיאה בטעינת התור:', err);
    }
  }, [stationId]);

  const sendUidToServer = useCallback(
    async (uid, source) => {
      const cleanUid = normalizeUid(uid);
      if (!cleanUid) return;

      // אנטי-כפילות
      if (lastProcessedUidRef.current === cleanUid) return;

      // מניעת שליחה כפולה במקביל
      if (isSendingRef.current) return;
      isSendingRef.current = true;

      setLastSource(source);
      setMessage(`📡 UID נקלט (${cleanUid}) — שולח לשרת… (${source})`);

      try {
        const res = await fetch(`${SERVER_URL}/queue/add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ uid: cleanUid, stationId }),
        });

        const data = await res.json();

        if (res.ok) {
          lastProcessedUidRef.current = cleanUid;
          setMessage(`✅ ${data.message || 'נוסף לתור'} (${source})`);
          await fetchQueue();
        } else {
          setMessage(`❌ ${data.error || 'שגיאה בהוספה לתור'} (${source})`);
        }
      } catch (e) {
        setMessage(`❌ שגיאה בשליחה לשרת (${source})`);
      } finally {
        setTimeout(() => {
          isSendingRef.current = false;
          setMessage(mode === 'bridge' ? '🔌 Bridge פעיל — ממתין לצמיד…' : '📳 Web NFC פעיל — ממתין לצמיד…');
        }, 250);
      }
    },
    [stationId, fetchQueue, mode]
  );

  const startBridge = useCallback(() => {
    if (bridgeStartedRef.current) return;
    bridgeStartedRef.current = true;

    setMode('bridge');
    setMessage('🔌 Web NFC לא סיפק UID — עובר ל-Bridge (localhost:9000)…');

    let alive = true;

    const poll = async () => {
      if (!alive) return;

      try {
        const res = await fetch(BRIDGE_URL, { cache: 'no-store' });
        const data = await res.json();

        bridgeActiveRef.current = true;

        const uid = normalizeUid(data?.uid);
        if (uid) {
          await sendUidToServer(uid, 'BRIDGE');
        }
      } catch (err) {
        // אם ה-bridge לא רץ/חסום - לא מציפים הודעה כל 300ms
        // נשאיר את הסטטוס הכללי על "ממתין"
      } finally {
        setTimeout(poll, BRIDGE_POLL_MS);
      }
    };

    poll();

    return () => {
      alive = false;
    };
  }, [sendUidToServer]);

  const startWebNfc = useCallback(async () => {
    setMode('webnfc');

    if (!('NDEFReader' in window)) {
      setMessage('⚠️ אין Web NFC בדפדפן — עובר ל-Bridge…');
      startBridge();
      return;
    }

    try {
      const reader = new window.NDEFReader();
      await reader.scan();
      setMessage('📳 Web NFC פעיל — ממתין לצמיד…');

      reader.onreading = async (event) => {
        const uid = normalizeUid(event?.serialNumber);

        // 👇 זה בדיוק המקרה של Samsung A16: empty tag / serialNumber ריק
        if (!uid) {
          // עוברים ל-Bridge פעם אחת
          if (!bridgeStartedRef.current) {
            setMessage('⚠️ נסרק תג אבל אין UID (empty tag). עובר ל-Bridge…');
            startBridge();
          }
          return;
        }

        await sendUidToServer(uid, 'WEB_NFC');
      };

      reader.onreadingerror = () => {
        if (!bridgeStartedRef.current) {
          setMessage('⚠️ שגיאת Web NFC. עובר ל-Bridge…');
          startBridge();
        }
      };
    } catch (err) {
      if (!bridgeStartedRef.current) {
        setMessage('⚠️ לא ניתן להתחיל Web NFC. עובר ל-Bridge…');
        startBridge();
      }
    }
  }, [sendUidToServer, startBridge]);

  // Start: Web NFC first
  useEffect(() => {
    startWebNfc();
  }, [startWebNfc]);

  // Queue refresh
  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 3000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  return (
    <div
      className="scanner"
      style={{
        textAlign: 'center',
        padding: '20px',
        maxWidth: 520,
        margin: '0 auto',
      }}
    >
      <h2>סריקת צמיד – תחנה {stationId}</h2>

      <div style={{ fontSize: 13, opacity: 0.85, marginBottom: 6 }}>
        מצב: <b>{mode}</b>
        {lastSource ? (
          <>
            {' '}| מקור אחרון: <b>{lastSource}</b>
          </>
        ) : null}
      </div>

      <p style={{ minHeight: 24 }}>{message}</p>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          type="button"
          onClick={() => {
            // איפוס ניסיון סריקה
            bridgeStartedRef.current = false;
            bridgeActiveRef.current = false;
            startWebNfc();
          }}
          style={{ padding: '10px 14px', cursor: 'pointer' }}
        >
          🔄 התחל מחדש (Web NFC)
        </button>

        <button
          type="button"
          onClick={() => {
            if (!bridgeStartedRef.current) startBridge();
            else setMessage('🔌 Bridge כבר פעיל — ממתין לצמיד…');
          }}
          style={{ padding: '10px 14px', cursor: 'pointer' }}
        >
          🔌 הפעל Bridge ידנית
        </button>

        <button
          type="button"
          onClick={fetchQueue}
          style={{ padding: '10px 14px', cursor: 'pointer' }}
        >
          🔄 רענן תור
        </button>
      </div>

      <h3>🕓 ממתינים בתור:</h3>
      {queue.length === 0 ? (
        <p>אין ממתינים כרגע</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, lineHeight: '1.8' }}>
          {queue.map((name, idx) => (
            <li key={idx}>
              {idx + 1}. {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default QueueScanner;
