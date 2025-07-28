import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './App.css';

const SERVER_URL =
  process.env.REACT_APP_API_BASE_URL || 'https://personalliveresults.onrender.com';

function NfcPersonalScanner({ params }) {
  const [athleteName, setAthleteName] = useState('');
  const [category, setCategory] = useState('');
  const [club, setClub] = useState('');
  const [score, setScore] = useState(null);
  const [routeAttempts, setRouteAttempts] = useState({});
  const [searchId, setSearchId] = useState('');
  const [error, setError] = useState('');
  const [isIdMode, setIsIdMode] = useState(false);

  const uidFromURL = window.location.pathname.split('/').pop();

  useEffect(() => {
    if (uidFromURL.length > 3 && !isIdMode) {
      fetchDataByUID(uidFromURL);
    }
  }, [uidFromURL]);

  const fetchDataByUID = async (uid) => {
    try {
      const res = await axios.get(`${SERVER_URL}/search-uid/${uid}`);
      if (res.data && res.data.name) {
        fetchPersonalResults(res.data.name);
      } else {
        setError('לא נמצאו נתונים עבור הצמיד הזה.');
      }
    } catch (err) {
      console.error(err);
      setError('שגיאה בחיפוש לפי UID.');
    }
  };

  const fetchDataByID = async () => {
    if (!searchId.trim()) return;

    try {
      const res = await axios.get(`${SERVER_URL}/search-id/${searchId.trim()}`);
      if (res.data && res.data.name) {
        fetchPersonalResults(res.data.name);
      } else {
        setError('לא נמצאו נתונים עבור תעודת הזהות.');
      }
    } catch (err) {
      console.error(err);
      setError('שגיאה בחיפוש לפי תעודת זהות.');
    }
  };

  const fetchPersonalResults = async (name) => {
    try {
      const res = await axios.get(`${SERVER_URL}/personal-results/${encodeURIComponent(name)}`);
      const { category, club, score, routeAttempts } = res.data;

      setAthleteName(name);
      setCategory(category);
      setClub(club);
      setScore(score);
      setRouteAttempts(routeAttempts);
      setError('');
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת תוצאות אישיות.');
    }
  };

  return (
    <div className="App">
      <h2>🔍 תצוגת תוצאות אישיות</h2>

      {!athleteName && (
        <>
          <p>או הזן תעודת זהות:</p>
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder='הקלד ת"ז'
          />
          <br />
          <button onClick={() => { setIsIdMode(true); fetchDataByID(); }}>
            חפש לפי תעודת זהות
          </button>
        </>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {athleteName && (
        <>
          <h3>שם: {athleteName}</h3>
          <p>קטגוריה: {category}</p>
          <p>מועדון: {club}</p>
          <p>ניקוד כולל: {score} ({Object.values(routeAttempts).filter(v => v.success).length}/7)</p>

          <table>
            <thead>
              <tr>
                <th>מסלול</th>
                <th>ניסיונות</th>
                <th>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(routeAttempts).map(([route, data]) => (
                <tr key={route}>
                  <td>{route}</td>
                  <td>{data.attempts}</td>
                  <td>{data.success ? '✅' : '❌'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default NfcPersonalScanner;
