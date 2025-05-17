import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import MainApp from './MainApp.js';
import QueueScanner from './QueueScanner';

const App = () => (
  <Router>
    <Routes>
      <Route path="/" element={<MainApp />} />
      <Route path="/queue-scanner/:stationId" element={<QueueScanner />} />
    </Routes>
  </Router>
);

export default App;