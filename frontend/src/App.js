import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import QueueScanner from './QueueScanner.js';
import './App.css';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'https://cljs.onrender.com';

const App = () => {
  const location = useLocation();
  const parts = location.pathname.split('/');
  const stationIdFromPath = parts[1] === 'queue-scanner' ? parts[2] : null;

  // כל ה־hooks תמיד נקראים ללא תנאי
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

  // useEffect לדוגמה
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

  // במקום return מוקדם – החלק הגמיש יופיע כאן:
  if (stationIdFromPath) {
    return <QueueScanner stationId={stationIdFromPath} />;
  }

  return (
    <div className="App">
      <h2>🧗 ממשק שיפוט תחרות</h2>
      <button onClick={() => setIsRegisterMode(prev => !prev)}>
        {isRegisterMode ? 'עבור למצב שיפוט' : 'עבור למצב רישום'}
      </button>
      {/* כאן ימשיך שאר הממשק שלך */}
    </div>
  );
};

export default App;