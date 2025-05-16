import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import QueueScanner from './QueueScanner.js';
import './App.css';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

const App = () => {
  const location = useLocation();
  const parts = location.pathname.split('/');
  const stationIdFromPath = parts[1] === 'queue-scanner' ? parts[2] : null;

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
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [nfcMessage, setNfcMessage] = useState('');
  const [stationId, setStationId] = useState('');
  const [nextInQueue, setNextInQueue] = useState('');

  if (stationIdFromPath) {
    return <QueueScanner stationId={stationIdFromPath} />;
  }

  const handleAddExtra = () => {
    if (newExtra && !extraCompetitors.includes(newExtra)) {
      setExtraCompetitors(prev => [...prev, newExtra]);
      setNewExtra('');
    }
  };

  const handleSelectChange = e => setSelectedName(e.target.value);

  useEffect(() => {
    fetch(`${SERVER_URL}/refresh`)
      .then(res => res.json())
      .then(() => fetch(`${SERVER_URL}/live`))
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
      .catch(err => console.error('❌ שגיאה בשחזור או בשליפת מתחרים:', err));
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
        setSyncMessage(`✅ ${pending.length} ניסיון${pending.length > 1 ? 'ים' : ''} סונכרנו בהצלחה!`);
        setAdminCode('');
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

  const fetchNextInQueue = async () => {
    if (!stationId) return;
    try {
      const res = await fetch(`${SERVER_URL}/queue/${stationId}`);
      const data = await res.json();
      if (data.next) {
        setSelectedName(data.next);
        setNextInQueue(data.next);
      } else {
        setNextInQueue('אין אף אחד בתור');
      }
    } catch (err) {
      setNextInQueue('שגיאה בשליפה');
    }
  };

  const dequeueCurrent = async () => {
    if (!stationId) return;
    await fetch(`${SERVER_URL}/queue/dequeue`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stationId })
    });
    setNextInQueue('');
  };

  const handleNfcRegistration = async () => {
    if (!selectedName) {
      setNfcMessage('יש לבחור מתחרה לפני סריקת צמיד');
      return;
    }

    try {
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
            const response = await fetch(`${SERVER_URL}/register-nfc`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: selectedName, uid })
            });

            const data = await response.json();
            if (response.ok) {
              setNfcMessage(data.message || 'הצמיד שויך בהצלחה ✅');
            } else {
              setNfcMessage(`❌ ${data.error || 'שגיאה בשיוך הצמיד'}`);
            }
          } catch (err) {
            console.error('שגיאה בשליחת UID:', err);
            setNfcMessage('❌ שגיאה בשליחת UID');
          }
        };
      } else {
        setNfcMessage('המכשיר שלך לא תומך ב־NFC');
      }
    } catch (err) {
      console.error('שגיאת NFC:', err);
      setNfcMessage('❌ שגיאה בקריאת NFC');
    }
  };

  return (
    <div className="App">
      {/* ממשק הרישום והשיפוט נשאר בדיוק כפי שהיה, כולל בחירת קטגוריות, מתחרים, שיפוט וכו' */}
    </div>
  );
};

export default App;
