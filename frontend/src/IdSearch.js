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

      const personalRes = await fetch(`${SERVER_URL}/personal/${encodeURIComponent(data.name)}`);
      const personal = await personalRes.json();

      if (!personalRes.ok || personal.error) {
        setMessage('❌ שגיאה בשליפת תוצאות');
        return;
      }

      console.log('🔎 personal:', personal);
      setPersonalData(personal);
    } catch (err) {
      setMessage('❌ שגיאה בשליפת נתונים מהשרת');
    }
  };

  const topRoutes = personalData?.results
    ?.filter(r => r.success)
    ?.sort((a, b) => {
      if (b.score === a.score) return b.route - a.route;
      return b.score - a.score;
    })
    ?.slice(0, 7)
    ?.map(r => r.route) || [];

  return (
    <div style={{ padding: 20, direction: 'rtl', textAlign: 'center' }}>
      <h2>📲 צפייה בתוצאות לפי ת.ז</h2>
      <input
        type="text"
        placeholder="הכנס ת.ז"
        value={idNumber}
        onChange={(e) => setIdNumber(e.target.value)}
        className="nfc-input"
      />
      <button onClick={handleSearch} className="nfc-button">בדוק</button>
      {message && <p style={{ fontSize: 18 }}>{message}</p>}

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
                if (success) {
                  bgColor = '#e0ffe0';
                } else if (attempts === 5) {
                  bgColor = '#fff5cc';
                } else if (attempts != null) {
                  bgColor = '#fff0f0';
                }

                let attemptDisplay = '-';
                if (attempts != null) {
                  if (!success && attempts === 4) {
                    attemptDisplay = <span style={{ color: '#ff9900', fontWeight: 'bold' }}>{attempts}</span>;
                  } else if (!success && attempts === 5) {
                    attemptDisplay = <span style={{ color: '#cc0000', fontWeight: 'bold' }}>{attempts}</span>;
                  } else {
                    attemptDisplay = attempts;
                  }
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
