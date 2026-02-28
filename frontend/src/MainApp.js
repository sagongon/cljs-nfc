import React, { useEffect, useState } from 'react';
import './App.css';

// trigger redeploy due to category order fix
const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

const LS_ALLOWED_ROUTES_KEY = 'allowedRoutes';

const MainApp = () => {
  const [competitorsFull, setCompetitorsFull] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [extraCompetitors, setExtraCompetitors] = useState([]);
  const [showCatSelector, setShowCatSelector] = useState(false);
  const [showRoutesSelector, setShowRoutesSelector] = useState(false);

  const [filteredNames, setFilteredNames] = useState([]);
  const [newExtra, setNewExtra] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [routeNumber, setRouteNumber] = useState('');
  const [history, setHistory] = useState([]);
  const [locked, setLocked] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [correctionMessage, setCorrectionMessage] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [, setLastName] = useState('');
  const [, setLastRoute] = useState('');

  const [pendingResult, setPendingResult] = useState(null);
  const [warningMsg, setWarningMsg] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const [nfcMessage, setNfcMessage] = useState('');
  const [stationId, setStationId] = useState('');
  const [nextInQueue, setNextInQueue] = useState('');

  // --- Local judge routes (per device) ---
  const [allowedRoutesText, setAllowedRoutesText] = useState('');
  const [allowedRoutes, setAllowedRoutes] = useState([]);

  // reset selected categories when toggling register/judge mode
  useEffect(() => {
    setSelectedCategories([]);
  }, [isRegisterMode]);

  // load allowed routes from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(LS_ALLOWED_ROUTES_KEY);
    if (saved) {
      try {
        const arr = JSON.parse(saved);
        if (Array.isArray(arr)) {
          setAllowedRoutes(arr);
          setAllowedRoutesText(arr.join(','));
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const normalizeRoutes = (text) => {
    const routes = text
      .split(/[,\s]+/)
      .map((r) => r.trim())
      .filter((r) => r && !isNaN(r))
      .map((r) => String(Number(r))); // "01" -> "1"

    return Array.from(new Set(routes)).sort((a, b) => Number(a) - Number(b));
  };

  const saveAllowedRoutes = () => {
    const routes = normalizeRoutes(allowedRoutesText);
    setAllowedRoutes(routes);
    localStorage.setItem(LS_ALLOWED_ROUTES_KEY, JSON.stringify(routes));

    if (routeNumber && routes.length > 0 && !routes.includes(String(routeNumber))) {
      setRouteNumber('');
      setHistory([]);
      setLocked(false);
    }
  };

  // ✅ FIX: no in-place sort on state arrays (prevents delayed "selected" paint)
  const toggleRoute = (routeStr) => {
    setAllowedRoutes((prev) => {
      const next = prev.includes(routeStr)
        ? prev.filter((r) => r !== routeStr)
        : [...prev, routeStr];

      const sorted = [...next].sort((a, b) => Number(a) - Number(b));

      localStorage.setItem(LS_ALLOWED_ROUTES_KEY, JSON.stringify(sorted));
      setAllowedRoutesText(sorted.join(','));

      if (routeNumber && !sorted.includes(String(routeNumber))) {
        setRouteNumber('');
        setHistory([]);
        setLocked(false);
      }

      return sorted;
    });
  };

  const handleAddExtra = () => {
    if (newExtra && !extraCompetitors.includes(newExtra)) {
      setExtraCompetitors((prev) => [...prev, newExtra]);
      setNewExtra('');
    }
  };

const toggleExtraCompetitor = (name) => {
  setExtraCompetitors((prev) =>
    prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
  );
};

  const handleSelectChange = (e) => setSelectedName(e.target.value);

const fetchWithTimeout = async (url, options = {}, timeoutMs = 2500) => {
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
};

const fetchNextInQueue = async (retries = 6, delayMs = 700) => {
  if (!stationId) return;

  try {
    const res = await fetchWithTimeout(
      `${SERVER_URL}/queue/${stationId}/all`,
      {},
      2500
    );

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const queueList = data.queue || [];

    if (queueList.length > 0) {
  const nextName = (queueList[0] || '').toString().trim();

  // ✅ לא מאפסים קטגוריות!
  setSelectedName(nextName);
  setNextInQueue(queueList[1] || 'אין עוד ממתינים');

  } else {
      setSelectedName('');
      setNextInQueue('אין אף אחד בתור');
    }
  } catch (err) {
    console.warn('fetchNextInQueue failed:', err?.name, err?.message || err);

    if (retries > 0) {
      setNextInQueue('ממתין לחיבור לשרת...');
      setTimeout(() => fetchNextInQueue(retries - 1, delayMs), delayMs);
      return;
    }

    setNextInQueue('שגיאה בשליפה');
  }
};

  const dequeueCurrent = async () => {
    if (!stationId) return;
    try {
      await fetch(`${SERVER_URL}/queue/dequeue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stationId })
      });
      await fetchNextInQueue();
    } catch (err) {
      console.error('שגיאה בהסרת מתחרה מהתור:', err);
    }
  };

  const handleNfcRegistration = async () => {
    if (!selectedName) {
      setNfcMessage('יש לבחור מתחרה לפני סריקת צמיד');
      return;
    }

    try {
      try {
        await fetch('http://localhost:9000/current-name', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: selectedName })
        });
      } catch (err) {
        console.warn('⚠️ לא הצלחנו לשמור את השם בשרת NFC:', err);
      }

      if ('NDEFReader' in window) {
        const reader = new window.NDEFReader();
        await reader.scan();
        setNfcMessage('⏳ ממתין להצמדת צמיד...');

        let alreadyProcessed = false;
        reader.onreading = async (event) => {
          if (alreadyProcessed) return;
          alreadyProcessed = true;

          const uid = event.serialNumber;
          setNfcMessage('📡 שולח UID לשרת...');

          try {
            const response = await fetch(`${SERVER_URL}/assign-nfc`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: selectedName, uid })
            });

            const data = await response.json();
            if (response.ok) setNfcMessage(data.message || 'הצמיד שויך בהצלחה ✅');
            else setNfcMessage(`❌ ${data.error || 'שגיאה בשיוך הצמיד'}`);
          } catch (err) {
            console.error('שגיאה בשליחת UID:', err);
            setNfcMessage('❌ שגיאה בשליחת UID');
          }
        };
      } else {
        setNfcMessage('📡 ממתין להצמדת צמיד חדש...');
        try {
          let uid = '';
          const maxWaitTime = 10000;
          const pollInterval = 500;
          const startTime = Date.now();

          while (!uid && Date.now() - startTime < maxWaitTime) {
            const res = await fetch('http://localhost:9000/get-latest-uid');
            const data = await res.json();
            if (data && data.uid) {
              uid = data.uid;
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
          }

          if (!uid) {
            setNfcMessage('⚠️ לא נמשה UID – ודא שהצמיד הוצמד בזמן');
            return;
          }

          setNfcMessage('📡 UID נמשה, שולח לשרת...');
          const response = await fetch(`${SERVER_URL}/assign-nfc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: selectedName, uid })
          });

          const data = await response.json();
          if (response.ok) setNfcMessage(data.message || 'הצמיד שויך בהצלחה ✅');
          else setNfcMessage(`❌ ${data.error || 'שגיאה בשיוך הצמיד'}`);
        } catch (error) {
          console.error('שגיאת NFC:', error);
          setNfcMessage('❌ שגיאה בקריאת NFC');
        }
      }
    } catch (err) {
      console.error('שגיאת NFC:', err);
      setNfcMessage('❌ שגיאה בקריאת NFC');
    }
  };

  useEffect(() => {
    fetch(`${SERVER_URL}/refresh`)
      .then((res) => res.json())
      .then(() => fetch(`${SERVER_URL}/live`))
      .then((res) => res.json())
      .then((data) => {
        const cats = Object.keys(data);
        setCategories(cats);
        const full = [];
        cats.forEach((cat) =>
          data[cat].forEach((comp) => full.push({ name: comp.name, category: cat }))
        );
        setCompetitorsFull(full);
        localStorage.setItem('cachedCompetitors', JSON.stringify(full));
        localStorage.setItem('cachedCategories', JSON.stringify(cats));
      })
      .catch((err) => {
        console.error('❌ שגיאה בשליפת מתחרים – מנסה מהזיכרון:', err);
        const cached = localStorage.getItem('cachedCompetitors');
        const cats = localStorage.getItem('cachedCategories');
        if (cached && cats) {
          setCompetitorsFull(JSON.parse(cached));
          setCategories(JSON.parse(cats));
        }
      });
  }, []);

  useEffect(() => {
    let names = competitorsFull
      .filter((c) => selectedCategories.includes(c.category) || extraCompetitors.includes(c.name))
      .map((c) => c.name);

    if (!selectedCategories.length && !extraCompetitors.length) {
      names = competitorsFull.map((c) => c.name);
    }

    setFilteredNames(Array.from(new Set(names)).sort());
  }, [competitorsFull, selectedCategories, extraCompetitors]);

  useEffect(() => {
    if (selectedName && routeNumber) {
      fetchHistory(selectedName, routeNumber);
      setAdminCode('');
    } else {
      setHistory([]);
      setLocked(false);
      setIsLoadingHistory(false);
    }
  }, [selectedName, routeNumber]);

  const fetchHistory = async (name, route) => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(
        `${SERVER_URL}/history?name=${encodeURIComponent(name)}&route=${route}`
      );
      const data = await res.json();
      setHistory(data.history);
      setLocked(data.locked);
    } catch {
      const all = JSON.parse(localStorage.getItem('offlineAttempts') || '[]');
      const localH = [];
      all
        .filter((a) => a.name === name && +a.route === +route)
        .forEach((a) => (a.result === 'RESET' ? (localH.length = 0) : localH.push(a.result)));
      setHistory(localH);
      setLocked(localH.includes('T') || localH.length >= 5);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Guard: require name+route always
  const ensureNameAndRoute = () => {
    if (!selectedName) {
      setWarningMsg('יש לבחור מתחרה לפני בחירת מסלול/רישום ניסיון');
      return false;
    }
    if (!routeNumber) {
      setWarningMsg('יש לבחור מסלול לפני רישום ניסיון');
      return false;
    }
    return true;
  };

  const requestMark = (res) => {
    if (!ensureNameAndRoute()) return;

    if (allowedRoutes.length > 0 && !allowedRoutes.includes(String(routeNumber))) {
      setWarningMsg('המסלול שנבחר לא מוגדר לשופט זה');
      return;
    }

    confirmMark(res);
  };

  const confirmMark = async (res) => {
    if (isSubmitting) return;

    if (!ensureNameAndRoute()) return;

    if (allowedRoutes.length > 0 && !allowedRoutes.includes(String(routeNumber))) {
      setWarningMsg('המסלול שנבחר לא מוגדר לשופט זה');
      return;
    }

    setIsSubmitting(true);

    const entry = {
      name: selectedName,
      route: routeNumber,
      result: res,
      stationId,
      timestamp: new Date().toISOString()
    };

    const pending = JSON.parse(localStorage.getItem('offlineAttempts') || '[]');
    pending.push(entry);
    localStorage.setItem('offlineAttempts', JSON.stringify(pending));

    setHistory((prev) => [...prev, res]);

    try {
      const resp = await fetch(`${SERVER_URL}/mark`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });

      if (resp.ok) {
        const data = await resp.json();
        setHistory(data.history);
        setLocked(data.locked);
      }
    } catch {
      // offline handled via localStorage
    } finally {
      setIsSubmitting(false);
    }

    setLastName(selectedName);
    setLastRoute(routeNumber);
    setWarningMsg('');
    setPendingResult(null);

    fetchHistory(selectedName, routeNumber);

    setTimeout(() => {
      setSelectedName('');
      setRouteNumber('');
    }, 100);
  };

  const cancelMark = () => {
    setWarningMsg('');
    setPendingResult(null);
    setSelectedName('');
    setRouteNumber('');
  };

  const handleCorrection = () => {
    if (!adminCode) return;
    fetch(`${SERVER_URL}/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: selectedName, route: routeNumber, judgePassword: adminCode })
    })
      .then((res) => res.json())
      .then((data) => {
        const all = JSON.parse(localStorage.getItem('offlineAttempts') || '[]');
        all.push({
          name: selectedName,
          route: routeNumber,
          result: 'RESET',
          timestamp: new Date().toISOString()
        });
        localStorage.setItem('offlineAttempts', JSON.stringify(all));
        setCorrectionMessage(data.message);
        setTimeout(() => setCorrectionMessage(''), 3000);
        setHistory([]);
        setLocked(false);
        setAdminCode('');
      })
      .catch(() => console.error('Correction failed'));
  };

  const syncPendingAttempts = async () => {
    const pending = JSON.parse(localStorage.getItem('offlineAttempts') || '[]');
    if (!pending.length) {
      setAdminCode('');
      return;
    }
    try {
      const res = await fetch(`${SERVER_URL}/sync-offline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attempts: pending })
      });
      if (res.ok) {
        localStorage.removeItem('offlineAttempts');
        setSyncMessage(
          `✅ ${pending.length} ניסיון${pending.length > 1 ? 'ים' : ''} סונכרנו בהצלחה!`
        );
        setAdminCode('');
        setTimeout(() => setSyncMessage(''), 3000);
      }
    } catch {
      console.error('Sync failed');
    }
  };

const resetAllQueues = async () => {
  if (!adminCode?.trim()) {
    alert('יש להזין קוד שופט');
    return;
  }

  const ok = window.confirm(
    '⚠️ לאפס את כל התורים בכל התחנות?\nפעולה זו מיועדת לסוף מקצה.'
  );
  if (!ok) return;

  try {
    const res = await fetch(`${SERVER_URL}/queue/reset-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ judgePassword: adminCode })
    });

        const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      alert(data?.error || 'שגיאה באיפוס תורים');
      return;
    }

    alert(data?.message || 'כל התורים אופסו בהצלחה');
  } catch (err) {
    console.error('reset-all failed:', err);
    alert('❌ שגיאת תקשורת לשרת');
  }
};

  const canChooseRoute = Boolean(selectedName);

  const selectRouteFromButtons = (r) => {
    if (!canChooseRoute) return;
    setRouteNumber(String(r));
  };

  const renderRouteButtons = () => (
    <div className="routes-grid">
      {allowedRoutes.map((r) => (
        <button
          key={r}
          onClick={() => selectRouteFromButtons(r)}
          disabled={!canChooseRoute}
          className={`route-btn route-btn--main ${routeNumber === r ? 'selected' : ''}`}
          type="button"
        >
          {r}
        </button>
      ))}
    </div>
  );

  return (
    <div className="App">
      <h2>🧗 מערכת שיפוט תחרות</h2>

      {!showCatSelector && !showRoutesSelector && (
        <button onClick={() => setIsRegisterMode((prev) => !prev)} type="button">
          {isRegisterMode ? 'עבור למצב שיפוט' : 'עבור למצב רישום'}
        </button>
      )}

      {isRegisterMode ? (
        <div>
          <h3>רישום מתחרה</h3>
          <label>בחר קטגוריה:</label>
          <br />
          {categories.map((cat) => (
            <button
              key={cat}
              className={`category-btn ${selectedCategories.includes(cat) ? 'selected' : ''}`}
              onClick={() =>
                setSelectedCategories((prev) =>
                  prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                )
              }
              type="button"
            >
              {cat}
            </button>
          ))}
          <br />
          <br />
          <label>בחר מתחרה:</label>
          <select onChange={(e) => setSelectedName(e.target.value)} value={selectedName}>
            <option value="">-- בחר --</option>
            {filteredNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <br />
          <br />
          <button disabled={!selectedName} onClick={handleNfcRegistration} type="button">
            📳 הצמד צמיד
          </button>
          {nfcMessage && <p>{nfcMessage}</p>}
        </div>
      ) : (
        <>
          <button onClick={() => setShowCatSelector((prev) => !prev)} type="button">
            {showCatSelector ? 'סגור קטגוריות' : 'בחר קטגוריות'}
          </button>

          <button
            onClick={() => setShowRoutesSelector((prev) => !prev)}
            style={{ marginLeft: 8 }}
            type="button"
          >
            {showRoutesSelector ? 'סגור מסלולים' : 'בחר מסלולים'}
          </button>

          {showCatSelector && (
            <div className="category-selector">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`category-btn ${selectedCategories.includes(cat) ? 'selected' : ''}`}
                  onClick={() =>
                    setSelectedCategories((prev) =>
                      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                    )
                  }
                  type="button"
                >
                  {cat}
                </button>
              ))}
              <div>
                <input
                  list="all-names"
                  value={newExtra}
                  onChange={(e) => setNewExtra(e.target.value)}
                  placeholder="הוסף מתחרה נוסף"
                />
                <datalist id="all-names">
                  {[...competitorsFull]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((c) => (
                      <option key={c.name} value={c.name} />
                    ))}
                </datalist>
                <button onClick={handleAddExtra} disabled={!newExtra} type="button">
                  הוסף
                </button>
              </div>
{extraCompetitors.length > 0 && (
  <div style={{ marginTop: 10 }}>
    <div style={{ fontSize: 13, marginBottom: 6, opacity: 0.85 }}>
      חריגים שנבחרו (לחיצה להסרה):
    </div>

    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {extraCompetitors.map((name) => (
        <button
          key={name}
          type="button"
          onClick={() => toggleExtraCompetitor(name)}
          className="extra-btn"
          title="לחץ להסרה"
        >
          {name} ✕
        </button>
      ))}
    </div>
  </div>
)}
              <button onClick={() => setExtraCompetitors([])} style={{ marginTop: 8 }} type="button">
                נקה נוספים
              </button>
            </div>
          )}

          {showRoutesSelector && (
            <div className="category-selector">
              <h4 style={{ marginTop: 0 }}>🎯 בחירת מסלולים לשופט (מקומי)</h4>

              <div style={{ marginBottom: 8 }}>
                <input
                  value={allowedRoutesText}
                  onChange={(e) => setAllowedRoutesText(e.target.value)}
                  placeholder="לדוגמה: 1,2,3,7"
                  style={{ width: '100%' }}
                />
                <button onClick={saveAllowedRoutes} style={{ marginTop: 6 }} type="button">
                  שמור רשימה
                </button>
              </div>

              <div className="routes-grid routes-grid--small">
                {Array.from({ length: 30 }, (_, i) => String(i + 1)).map((r) => (
                  <button
                    key={r}
                    onClick={() => toggleRoute(r)}
                    className={`route-btn route-btn--small ${allowedRoutes.includes(r) ? 'selected' : ''}`}
                    type="button"
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 10, fontSize: 13 }}>
                נבחרו: <b>{allowedRoutes.length ? allowedRoutes.join(', ') : '—'}</b>
              </div>
            </div>
          )}

          {!showCatSelector && !showRoutesSelector && (
            <>
              <select onChange={handleSelectChange} value={selectedName}>
                <option value="">בחר מתחרה</option>
                {filteredNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              {allowedRoutes.length > 0 ? (
                <>
                  {renderRouteButtons()}
                  {!selectedName && (
                    <p style={{ fontSize: 13, marginTop: 6, opacity: 0.8 }}>
                      ℹ️ קודם בחר מתחרה, ואז תוכל לבחור מסלול.
                    </p>
                  )}
                </>
              ) : (
                <input
                  type="number"
                  placeholder="מספר מסלול"
                  value={routeNumber}
                  min={1}
                  onChange={(e) => setRouteNumber(e.target.value)}
                  className="route-input"
                  disabled={!selectedName}
                  style={{ opacity: selectedName ? 1 : 0.5, cursor: selectedName ? 'text' : 'not-allowed' }}
                />
              )}

              <div className="button-container">
                <button onClick={() => requestMark('X')} disabled={locked || isSubmitting} type="button">
                  ❌ ניסיון
                </button>

                <button onClick={() => requestMark('T')} disabled={locked || isSubmitting} type="button">
                  ✅ הצלחה
                </button>

                {isSubmitting && <p className="saving-msg">⏳ נרשם…</p>}
              </div>

              {warningMsg && (
                <div className="warning-box">
                  <p>{warningMsg}</p>
                  <button onClick={() => confirmMark(pendingResult)} type="button">
                    כן
                  </button>
                  <button onClick={cancelMark} style={{ marginLeft: 4 }} type="button">
                    לא
                  </button>
                </div>
              )}

              {selectedName && routeNumber && !isLoadingHistory && (
                <p>
                  היסטוריה: {history.length ? history.join(', ') : 'אין'} {locked && '🔒 נעול'}
                </p>
              )}

              <hr />
              <h3>🔧 ממשק שופט ראשי</h3>

              <div style={{ marginBottom: 20 }}>
                <h4>⏱ תור לפי תחנה</h4>
                <input
                  type="number"
                  placeholder="מספר תחנה"
                  value={stationId}
                  onChange={(e) => setStationId(e.target.value)}
                  style={{ width: 120, marginLeft: 10 }}
                />
                <button onClick={fetchNextInQueue} disabled={!stationId} type="button">
                  הבא בתור
                </button>
                {nextInQueue && (
                  <div>
                    <p>
                      🔸 הבא בתור: <strong>{nextInQueue}</strong>
                    </p>
                    <button onClick={dequeueCurrent} style={{ marginTop: 4 }} type="button">
                      הסר מהתור
                    </button>
                  </div>
                )}
              </div>

              <input
                type="password"
                placeholder="קוד שופט ראשי"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
              />
              <button onClick={handleCorrection} disabled={!adminCode} type="button">
                איפוס תוצאות
              </button>
              <button
                onClick={syncPendingAttempts}
                disabled={!adminCode}
                style={{ marginLeft: 5 }}
                type="button"
              >
                סנכרון OFFLINE
              </button>

              <button
                onClick={resetAllQueues}
                disabled={!adminCode}
                style={{ marginLeft: 5, background: '#b91c1c', color: 'white' }}
                type="button"
             >
               🧹 איפוס כל התורים
             </button>

              {correctionMessage && <p className="message correction">{correctionMessage}</p>}
              {syncMessage && <p className="message sync">{syncMessage}</p>}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default MainApp;
