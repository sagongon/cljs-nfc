import React, { useState } from 'react';

const SERVER_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:9000'
    : 'https://personalliveresults.onrender.com';

export default function IdSearch() {
  const [idNumber, setIdNumber] = useState('');
  const [message, setMessage] = useState('');
  const [personalData, setPersonalData] = useState(null);

  const handleSearch = async () => {
    if (!idNumber) return;

    setMessage('🔍 מאתר את הספורטאי...');
    setPersonalData(null);

    try {
      const res = await fetch(`${SERVER_URL}/search-id/${idNumber}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        setMessage('❌ לא נמצא מתחרה עם תעודת זהות זו');
        return;
      }

      setMessage(`📋 מוצגות התוצאות של ${data.name}`);

      try {
        const personalRes = await fetch(`${SERVER_URL}/personal/${encodeURIComponent(data.name)}`);
        const personal = await personalRes.json();

        if (!personalRes.ok || personal.error) {
          setMessage('❌ שגיאה בשליפת תוצאות');
          return;
        }

        console.log('🔎 personal:', personal); // ניתוח הנתונים שהתקבלו
        setPersonalData(personal);
      } catch (err) {
        setMessage('❌ שגיאה בשליפת תוצאות מהשרת');
      }
    } catch (err) {
      setMessage('❌ שגיאה בשליפת נתונים מהשרת');
    }
  };

  return (
    <div className="nfc-personal-container">
      <h2>בדיקת תוצאות לפי תעודת זהות</h2>
      <input
        type="text"
        placeholder="הכנס ת.ז"
        value={idNumber}
        onChange={(e) => setIdNumber(e.target.value)}
        className="nfc-input"
      />
      <button onClick={handleSearch} className="nfc-button">בדוק</button>
      <p>{message}</p>

      {personalData && personalData.routes && (
        <div className="nfc-results">
          <h3>תוצאות עבור: {personalData.name}</h3>
          <table>
            <thead>
              <tr>
                <th>מסלול</th>
                <th>ניסיונות</th>
                <th>הצלחה</th>
                <th>ניקוד</th>
              </tr>
            </thead>
            <tbody>
              {personalData.routes.map((route, index) => (
                <tr key={index}>
                  <td>{route.number}</td>
                  <td>{route.attempts}</td>
                  <td>{route.success ? '✅' : '❌'}</td>
                  <td>{route.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p>סה"כ ניקוד: {personalData.totalScore}</p>
          <p>מסלולים מוצלחים: {personalData.successCount} / 7</p>
        </div>
      )}
    </div>
  );
}
