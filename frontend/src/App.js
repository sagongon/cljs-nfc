
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainApp from './MainApp.js';
import QueueScanner from './QueueScanner.js';
import LiveBoard from './LiveBoard.js';

const App = () => (
  <Router>
    <Routes>
      <Route path="/" element={<MainApp />} />
      <Route path="/queue-scanner/:stationId" element={<QueueScanner />} />
      <Route path="/live" element={<LiveBoard />} />
    </Routes>
  </Router>
);

export default App;
