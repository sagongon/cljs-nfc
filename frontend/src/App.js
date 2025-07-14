import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainApp from './MainApp.js';
import QueueScanner from './QueueScanner.js';
import LiveBoard from './LiveBoard.js';
import PersonalLiveBoard from './PersonalLiveBoard.js';
import NfcPersonalScanner from './NfcPersonalScanner.js';
import Menu from './Menu.js'; // ✅ הוספת דף תפריט

const App = () => (
  <Router>
    <Routes>
      <Route path="/" element={<MainApp />} />
      <Route path="/queue-scanner/:stationId" element={<QueueScanner />} />
      <Route path="/live" element={<LiveBoard />} />
      <Route path="/personal/:name" element={<PersonalLiveBoard />} />
      <Route path="/nfc-personal-scanner" element={<NfcPersonalScanner />} />
      <Route path="/menu" element={<Menu />} /> {/* ✅ נתיב חדש לתפריט */}
    </Routes>
  </Router>
);

export default App;
