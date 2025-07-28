/* IdSearch.js - צפייה בתוצאות לפי ת.ז */
import React, { useState } from 'react';

const SERVER_URL = 'https://personalliveresults.onrender.com';

export default function IdSearch() {
  const [idNumber, setIdNumber] = useState('');
  const [message, setMessage] = useState('הזן תעודת זהות ולחץ "חפש"');
  const [personalData, setPersonalData] = useState(null);

  const handleSearch = async () => {
    if (!idNumber.trim()) {
      setMessage('❌ נא להזין תעודת זהות');
      return;
    }

    setMessage('🔍 מאתר את הספורטאי לפי ת.ז...');
    setPersonalData(null);

    try {
      const res = await fetch(`${SERVER_URL}/search-id`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ idNumber })
      });

      const data = await res.json();

      if (!res.ok || data.error || !data.name) {
        setMessage('❌ לא נמצאו תוצאות עבור תעודת הזהות');
        return;
      }

      try {
  setMessage(`📋 מוצגות התוצאות של ${data.name}`);

  const personalRes = await fetch(`${SERVER_URL}/personal/${encodeURIComponent(data.name)}`);
  const personal = await personalRes.json();

  if (!personalRes.ok || personal.error) {
    setMessage('❌ שגיאה בשליפת תוצאות');
    return;
  }

  setPersonalData(personal);
} catch (err) {
  setMessage('❌ שגיאה בשליפת תוצאות מהשרת');
}`);
      setPersonalData(data);
    } catch (err) {
      setMessage('❌ שגיאה בשליפת נתונים מהשרת');
    }
  };

  const topRoutes = personalData?.results
    ?.filter(r => r.success)
    ?.sort((a, b) => (b.score === a.score ? b.route - a.route : b.score - a.score))
    ?.slice(0, 7)
    ?.map(r => r.route) || [];

  return (
    <div style={{ padding: 20, direction: 'rtl', textAlign: 'center' }}>
      <h2>תוצאות ספורטאי לפי UID או תעודת זהות</h2>
      <input
        type="text"
        placeholder="הכנס ת.ז"
        value={idNumber}
        onChange={(e) => setIdNumber(e.target.value)}
        style={{ padding: 10, width: '60%', marginBottom: 10 }}
      />
      <br />
      <button onClick={handleSearch} style={{ padding: '10px 20px', fontSize: 16 }}>חפש</button>

      <p style={{ fontSize: 18, color: personalData ? 'green' : 'red' }}>{message}</p>

      {personalData && (
        <div>
          <h3>שם: {personalData.name}</h3>
          <p>ניקוד כולל: {personalData.totalScore}</p>
          <p>מסלולים שהושלמו: {personalData.results.filter(r => r.success).length}/7</p>

          <table style={{ margin: 'auto', borderCollapse: 'collapse', width: '90%' }}>
            <thead>
              <tr>
                <th>מסלול</th>
                <th>ניסיונות</th>
                <th>ניקוד</th>
                <th>✔️</th>
                <th>🏅</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 30 }, (_, i) => {
                const routeNum = i + 1;
                const r = personalData.results.find(r => r.route === routeNum) || {};
                const { success, score = 0, attempts = null } = r;

                let bgColor = '#f0f0f0';
                if (success) bgColor = '#e0ffe0';
                else if (attempts === 5) bgColor = '#fff5cc';
                else if (attempts != null) bgColor = '#fff0f0';

                let attemptDisplay = '-';
                if (attempts != null) {
                  if (!success && attempts === 4)
                    attemptDisplay = <span style={{ color: '#ff9900', fontWeight: 'bold' }}>{attempts}</span>;
                  else if (!success && attempts === 5)
                    attemptDisplay = <span style={{ color: '#cc0000', fontWeight: 'bold' }}>{attempts}</span>;
                  else attemptDisplay = attempts;
                }

                const isTopRoute = topRoutes.includes(routeNum);

                return (
                  <tr key={routeNum} style={{ backgroundColor: bgColor }}>
                    <td>{routeNum}</td>
                    <td>{attemptDisplay}</td>
                    <td>{score}</td>
                    <td>{success ? '✅' : attempts != null ? '❌' : ''}</td>
                    <td>{isTopRoute ? '🏅' : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
