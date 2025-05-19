
import React, { useEffect, useState } from 'react';
import './App.css';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

const MainApp = () => {
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

  const handleAddExtra = () => {
    if (newExtra && !extraCompetitors.includes(newExtra)) {
      setExtraCompetitors(prev => [...prev, newExtra]);
      setNewExtra('');
    }
  };

  const handleSelectChange = e => setSelectedName(e.target.value);

  const fetchNextInQueue = async () => {
    if (!stationId) return;
    try {
      const res = await fetch(`${SERVER_URL}/queue/${stationId}/all`);
      const data = await res.json();
      const queueList = data.queue || [];

      if (queueList.length > 0) {
        setSelectedName(queueList[0]);
        setNextInQueue(queueList[1] || 'אין עוד ממתינים');
      } else {
        setSelectedName('');
        setNextInQueue('אין אף אחד בתור');
      }
    } catch (err) {
      console.error('שגיאה בשליפת תור:', err);
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

  return (
    <div className='App'>
      <h2>🧗 מערכת שיפוט תחרות</h2>
      <input
        type='number'
        placeholder='מספר תחנה'
        value={stationId}
        onChange={e => setStationId(e.target.value)}
        style={{ width: '120px', marginLeft: '10px' }}
      />
      <button onClick={fetchNextInQueue} disabled={!stationId}>הבא בתור</button>
      {nextInQueue && (
        <div>
          <p>🔸 הבא בתור: <strong>{nextInQueue}</strong></p>
          <button onClick={dequeueCurrent} style={{ marginTop: '4px' }}>הסר מהתור</button>
        </div>
      )}
      <select onChange={handleSelectChange} value={selectedName}>
        <option value=''>בחר מתחרה</option>
        {filteredNames.map(name => <option key={name} value={name}>{name}</option>)}
      </select>
    </div>
  );
};

export default MainApp;
