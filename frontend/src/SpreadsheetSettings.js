import React, { useState } from 'react';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

export default function SpreadsheetSettings() {
  const [adminPassword, setAdminPassword] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    if (!adminPassword || !sheetId) {
      setMessage('❌ יש למלא את כל השדות');
      return;
    }

    setMessage('⏳ שולח...');
    try {
      const res = await fetch(`${SERVER_URL}/set-active-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminCode: adminPassword, newSheetId: sheetId }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        setAdminPassword('');
        setSheetId('');
      } else {
        setMessage(`❌ ${data.error || 'שגיאה לא ידועה'}`);
      }
    } catch (err) {
      console.error('שגיאה בשליחת הבקשה:', err);
      setMessage(`❌ שגיאה בשליחת הבקשה לשרת: ${err.message || 'לא ניתן להתחבר לשרת'}`);
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
