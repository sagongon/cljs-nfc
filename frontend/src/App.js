
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

  return (
    <div className="App">
      <h2>🧗 מערכת שיפוט תחרות</h2>
      <p>אפליקציית השיפוט נטענת בהצלחה.</p>
    </div>
  );
};

export default App;
