import React, { useState } from 'react';

// שימוש באותה כתובת שרת כמו MainApp - זה מבטיח שאנחנו משתמשים באותו שרת
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

    setMessage(`⏳ שולח לשרת: ${SERVER_URL}...`);
    try {
      const res = await fetch(`${SERVER_URL}/set-active-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminCode: adminPassword, newSheetId: sheetId }),
      });

      if (!res.ok) {
        // אם יש שגיאת CORS או שגיאה אחרת, ננסה לקבל את הטקסט
        const errorText = await res.text();
        console.error('שגיאת שרת:', res.status, errorText);
        try {
          const errorData = JSON.parse(errorText);
          setMessage(`❌ ${errorData.error || 'שגיאה לא ידועה'}`);
        } catch {
          setMessage(`❌ שגיאת שרת (${res.status}): ${errorText || 'שגיאת CORS - השרת לא מעודכן'}`);
        }
        return;
      }

      const data = await res.json();
      setMessage(`✅ ${data.message}`);
      setAdminPassword('');
      setSheetId('');
    } catch (err) {
      console.error('שגיאה בשליחת הבקשה:', err);
      if (err.message.includes('CORS') || err.message.includes('Failed to fetch')) {
        setMessage(`❌ שגיאת CORS: השרת ב-${SERVER_URL} לא מעודכן או לא מאפשר גישה. אנא ודא שהשרת מעודכן עם התיקונים האחרונים.`);
      } else {
        setMessage(`❌ שגיאה בשליחת הבקשה לשרת: ${err.message || 'לא ניתן להתחבר לשרת'}`);
      }
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
