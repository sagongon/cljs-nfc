import React from 'react';
import { Routes, Route } from 'react-router-dom';
import QueueScanner from './QueueScanner.js';
import MainApp from './MainApp.js';

const App = () => {
  return (
    <Routes>
      <Route path="/" element={<MainApp />} />
      <Route path="/queue-scanner/:stationId" element={<QueueScanner />} />
    </Routes>
  );
};

export default App;
