import React, { useEffect, useState } from 'react';
import './App.css';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

const App = () => {
  const [competitorsFull, setCompetitorsFull] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [extraCompetitors, setExtraCompetitors] = useState([]);
  const [showCatSelector, setShowCatSelector] = useState(false);

  const [filteredNames, setFilteredNames] = useState([]);
  const [newExtra, setNewExtra] = useState('');

  const [selectedName, setSelectedName] = useState('');
  const [routeNumber, setRouteNumber] = useState('');
  const [history, setHistory] = useState([]);
  const [locked, setLocked] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [correctionMessage, setCorrectionMessage] = useState('');
  const [syncMessage, setSyncMessage] = useState('');
  const [lastName, setLastName] = useState('');
  const [lastRoute, setLastRoute] = useState('');
  const [pendingResult, setPendingResult] = useState(null);
  const [warningMsg, setWarningMsg] = useState('');

  const handleAddExtra = () => {
    if (newExtra && !extraCompetitors.includes(newExtra)) {
      setExtraCompetitors(prev => [...prev, newExtra]);
      setNewExtra('');
    }
  };
  const handleSelectChange = e => setSelectedName(e.target.value);

  useEffect(() => {
  // 1) תחילה: שחזור כל היסטוריית המתחרים מהגיליון (עם התחשבות ב־RESET)
  fetch(`${SERVER_URL}/refresh`)
    .then(res => res.json())
    .then(() => {
      console.log('✅ היסטוריה שוחזרה מהשרת');
      // 2) עכשיו תוכל בבטחה למשוך את הנתונים ל־live
      return fetch(`${SERVER_URL}/live`);
    })
    .then(res => res.json())
    .then(data => {
      const cats = Object.keys(data);
      setCategories(cats);
      const full = [];
      cats.forEach(cat =>
        data[cat].forEach(comp =>
          full.push({ name: comp.name, category: cat })
        )
      );
      setCompetitorsFull(full);
    })
    .catch(err =>
      console.error('❌ שגיאה בשחזור או בשליפת מתחרים:', err)
    );
}, []);


  useEffect(() => {
    let names = competitorsFull
      .filter(c => selectedCategories.includes(c.category) || extraCompetitors.includes(c.name))
      .map(c => c.name);
    if (!selectedCategories.length && !extraCompetitors.length) {
      names = competitorsFull.map(c => c.name);
    }
    setFilteredNames(Array.from(new Set(names)).sort());
  }, [competitorsFull, selectedCategories, extraCompetitors]);

  const fetchHistory = async (name, route) => {
    try {
      const res = await fetch(`${SERVER_URL}/history?name=${encodeURIComponent(name)}&route=${route}`);
      const data = await res.json();
      setHistory(data.history);
      setLocked(data.locked);
    } catch {
      const all = JSON.parse(localStorage.getItem('offlineAttempts') || '[]');
      const localH = [];
      all
        .filter(a => a.name === name && +a.route === +route)
        .forEach(a => (a.result === 'RESET' ? (localH.length = 0) : localH.push(a.result)));
      setHistory(localH);
      setLocked(localH.includes('T') || localH.length >= 5);
    }
  };

  const syncPendingAttempts = async () => {
    const pending = JSON.parse(localStorage.getItem('offlineAttempts') || '[]');
    if (!pending.length) return;
    if (!pending.length) {
      setAdminCode('');    // אפס קוד שופט גם כשאין מה לסננכרן
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
  setSyncMessage(`✅ ${pending.length} ניסיון${pending.length > 1 ? 'ים' : ''} סונכרנו בהצלחה!`);
  setAdminCode('');    // כאן מנקים את שדה קוד השופט
  setTimeout(() => setSyncMessage(''), 3000);
}

    } catch {
      console.error('Sync failed');
    }
  };

  useEffect(() => {
    if (selectedName && routeNumber) {
      fetchHistory(selectedName, routeNumber);
      setAdminCode('');
    } else {
      setHistory([]);
      setLocked(true);
    }
  }, [selectedName, routeNumber]);

  const requestMark = res => {
    let msg = '';
    if (lastName === selectedName && lastRoute === routeNumber && selectedName) {
      msg = '🔔 שימו לב: השם והמסלול לא השתנו מאז הפעם הקודמת. האם להמשיך?';
    } else if (lastName !== selectedName && lastRoute === routeNumber && selectedName) {
      msg = '🔔 שימו לב: המסלול לא שונה, האם המתחרה החדש עלה לאותו מסלול?';
    }
    if (msg) {
      setWarningMsg(msg);
      setPendingResult(res);
    } else {
      confirmMark(res);
    }
  };

  const confirmMark = async res => {
    const entry = { name: selectedName, route: routeNumber, result: res, timestamp: new Date().toISOString() };
    const pending = JSON.parse(localStorage.getItem('offlineAttempts') || '[]');
    pending.push(entry);
    localStorage.setItem('offlineAttempts', JSON.stringify(pending));
    setHistory(prev => [...prev, res]);
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
    } catch {}
    setLastName(selectedName);
    setLastRoute(routeNumber);
    setWarningMsg('');
    setPendingResult(null);
  };

  const cancelMark = () => {
    setWarningMsg('');
    setPendingResult(null);
  };

  const handleCorrection = () => {
    if (!adminCode) return;
    fetch(`${SERVER_URL}/correct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: selectedName, route: routeNumber, adminCode })
    })
      .then(res => res.json())
      .then(data => {
        const all = JSON.parse(localStorage.getItem('offlineAttempts') || '[]');
        all.push({ name: selectedName, route: routeNumber, result: 'RESET', timestamp: new Date().toISOString() });
        localStorage.setItem('offlineAttempts', JSON.stringify(all));
        setCorrectionMessage(data.message);
        setTimeout(() => setCorrectionMessage(''), 3000);
        setHistory([]);
        setLocked(false);
        setAdminCode('');
      })
      .catch(() => console.error('Correction failed'));
  };

  return (
    <div className='App'>
      <h2>🧗 מערכת שיפוט תחרות</h2>

      <button onClick={() => setShowCatSelector(prev => !prev)}>
        {showCatSelector ? 'סגור קטגוריות' : 'בחר קטגוריות'}
      </button>
      {showCatSelector && (
        <div className='category-selector'>
          {categories.map(cat => (
            <label key={cat}>
              <input
                type='checkbox'
                checked={selectedCategories.includes(cat)}
                onChange={() => setSelectedCategories(prev =>
                  prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                )}
              />
              {cat}
            </label>
          ))}
          <div>
            <input
              list='all-names'
              value={newExtra}
              onChange={e => setNewExtra(e.target.value)}
              placeholder='הוסף מתחרה נוסף'
            />
            <datalist id="all-names">
  {[...competitorsFull]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => (
      <option key={c.name} value={c.name} />
    ))
  }
</datalist>

            <button onClick={handleAddExtra} disabled={!newExtra}>הוסף</button>
          </div>
          <button onClick={() => setExtraCompetitors([])} style={{ marginTop: '8px' }}>נקה נוספים</button>
        </div>
      )}

      {!showCatSelector && (
        <>
          <select onChange={handleSelectChange} value={selectedName}>
            <option value=''>בחר מתחרה</option>
            {filteredNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <input
            type='number'
            placeholder='מספר מסלול'
            value={routeNumber}
            min={1}
            onChange={e => setRouteNumber(e.target.value)}
            className='route-input'
          />

          <div className='button-container'>
            <button onClick={() => requestMark('X')} disabled={locked}>❌ ניסיון</button>
            <button onClick={() => requestMark('T')} disabled={locked}>✅ הצלחה</button>
          </div>

          {warningMsg && (
            <div className='warning-box'>
              <p>{warningMsg}</p>
              <button onClick={() => confirmMark(pendingResult)}>כן</button>
              <button onClick={cancelMark} style={{ marginLeft: '4px' }}>לא</button>
            </div>
          )}

          {selectedName && routeNumber && (
            <p>היסטוריה: {history.length ? history.join(', ') : 'אין'} {locked && '🔒 נעול'}</p>
          )}

          <hr />
          <h3>🔧 ממשק שופט ראשי</h3>
          <input
            type='password'
            placeholder='קוד שופט ראשי'
            value={adminCode}
            onChange={e => setAdminCode(e.target.value)}
          />
          <button onClick={handleCorrection} disabled={!adminCode}>איפוס תוצאות</button>
          <button onClick={syncPendingAttempts} disabled={!adminCode} style={{ marginLeft: '5px' }}>סנכרון OFFLINE</button>
          {correctionMessage && <p className='message correction'>{correctionMessage}</p>}
          {syncMessage && <p className='message sync'>{syncMessage}</p>}
        </>
      )}
    </div>
  );
};

export default App;
