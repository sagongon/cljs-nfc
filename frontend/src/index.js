import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App.js';
import LiveBoard from './LiveBoard.js';
import QueueScanner from './QueueScanner.js'; // הוספת הייבוא
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { GoogleOAuthProvider } from '@react-oauth/google';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <Router>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/live" element={<LiveBoard />} />
          <Route path="/queue-scanner/:stationId" element={<QueueScanner />} /> {/* ⬅ זה מה שהיה חסר */}
        </Routes>
      </Router>
    </GoogleOAuthProvider>
  </React.StrictMode>
);
