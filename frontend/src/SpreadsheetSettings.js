import React, { useState } from 'react';

const SERVER_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:9000'
    : 'https://cljs-nfc.onrender.com'; // ✅ זה הראשי

export default function SpreadsheetSettings() {
  const [adminPassword, setAdminPassword] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/set-active-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminCode: adminPassword, newSheetId: sheetId }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message}`);
      } else {
        setMessage(`❌ ${data.error}`);
      }
    } catch (err) {
      setMessage('❌ שגיאה בשליחת הבקשה לשרת');
    }
  };

  return (
    <div className="settings-container">
      <h2>הגדרות גיליון</h2>
      <input
        type="password"
        placeholder="קוד מנהל"
        value={adminPassword}
        onChange={(e) => setAdminPassword(e.target.value)}
        className="admin-input"
      />
      <input
        type="text"
        placeholder="Spreadsheet ID החדש"
        value={sheetId}
        onChange={(e) => setSheetId(e.target.value)}
        className="sheet-id-input"
      />
      <button onClick={handleSubmit}>שמור גיליון חדש</button>
      {message && <p>{message}</p>}
    </div>
  );
}
