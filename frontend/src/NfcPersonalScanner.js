
import React, { useEffect, useState } from 'react';
import './LiveBoard.css';

const SERVER_URL = 'https://personalliveresults.onrender.com';

function NfcPersonalScanner() {
  const [uid, setUid] = useState('');
  const [name, setName] = useState('');
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState({});
  const [fallback, setFallback] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async (scannedUID) => {
    setLoading(true);
    try {
      const nameRes = await fetch(`${SERVER_URL}/nfc-name/${scannedUID}`);
      const nameData = await nameRes.json();
      setName(nameData.name || '');

      const scoreRes = await fetch(`${SERVER_URL}/personal-score/${scannedUID}`);
      const scoreData = await scoreRes.json();
      setScore(scoreData.total || 0);
      setAttempts(scoreData.attempts || {});
      setFallback(scoreData.fallback || []);
    } catch (err) {
      console.error('שגיאה בשליפת נתונים:', err);
      setName('');
      setScore(0);
      setAttempts({});
      setFallback([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if ('NDEFReader' in window) {
      const reader = new window.NDEFReader();
      reader.scan().then(() => {
        reader.onreading = (event) => {
          const serial = event.serialNumber;
          setUid(serial);
          fetchData(serial);
        };
      });
    } else {
      console.warn('NFC לא נתמך בדפדפן זה');
    }
  }, []);

  const routeRows = [];
  for (let route = 1; route <= 50; route++) {
    const data = attempts[route];
    const status = data?.status || 'none';
    const count = data?.count || 0;
    const score = data?.score || 0;

    if (status === 'success') {
      routeRows.push(
        <tr key={route}>
          <td>{route}</td>
          <td>{count}</td>
          <td>{score}</td>
          <td>✅</td>
        </tr>
      );
    } else {
      const fallbackAttempts = fallback.find(r => r.route === route);
      if (fallbackAttempts) {
        routeRows.push(
          <tr key={route}>
            <td>{route}</td>
            <td>{fallbackAttempts.count}</td>
            <td>0</td>
            <td>❌</td>
          </tr>
        );
      }
    }
  }

  const successful = Object.values(attempts).filter(r => r.status === 'success').length;

  return (
    <div className="live-board">
      <h2>📲 צפייה בתוצאות</h2>
      {loading ? <p>טוען נתונים...</p> : (
        <>
          {uid && <p><b>UID:</b> {uid}</p>}
          {name && <p><b>שם:</b> {name}</p>}
          {score !== null && (
            <p><b>:ניקוד כולל</b> {score} ({successful}/7)</p>
          )}
          <table>
            <thead>
              <tr>
                <th>מסלול</th>
                <th>ניסיונות</th>
                <th>ניקוד</th>
                <th></th>
              </tr>
            </thead>
            <tbody>{routeRows}</tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default NfcPersonalScanner;
