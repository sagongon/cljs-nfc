import React, { useState } from 'react';

const SERVER_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:9000'
    : 'https://personalliveresults.onrender.com';

export default function SpreadsheetSettings() {
  const [adminCode, setAdminCode] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = () => {
    if (adminCode === '007') {
      setAuthorized(true);
      setMessage('');
    } else {
      setMessage('❌ קוד מנהל לא תקין');
    }
  };

  const handleSubmit = async () => {
    try {
      const res = await fetch(`${SERVER_URL}/set-active-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminCode, newSheetId: sheetId }),
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
      {!authorized ? (
        <>
          <input
            type="password"
            placeholder="הזן קוד מנהל"
            value={adminCode}
            onChange={(e) => setAdminCode(e.target.value)}
            className="admin-input"
          />
          <button onClick={handleAuth}>אימות</button>
        </>
      ) : (
        <>
          <input
            type="text"
            placeholder="Spreadsheet ID החדש"
            value={sheetId}
            onChange={(e) => setSheetId(e.target.value)}
            className="sheet-id-input"
          />
          <button onClick={handleSubmit}>שמור גיליון חדש</button>
        </>
      )}
      {message && <p>{message}</p>}
    </div>
  );
}
