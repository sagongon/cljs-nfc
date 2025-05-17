import React from 'react';
import { useLocation } from 'react-router-dom';
import QueueScanner from './QueueScanner.js';
import MainApp from './MainApp.js';

const App = () => {
  const location = useLocation();

  // התניה ידנית על הנתיב - בלי Route
  if (location.pathname.startsWith('/queue-scanner/')) {
    const stationId = location.pathname.split('/')[2];
    return <QueueScanner stationId={stationId} />;
  }

  return <MainApp />;
};

export default App;
