import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import './LiveBoard.css';

const SERVER_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:4000'
    : 'https://personalliveresults.onrender.com';

const NfcPersonalScanner = () => {
  const { uid } = useParams();
  const [name, setName] = useState('');
  const [idInput, setIdInput] = useState('');
  const [isIdMode, setIsIdMode] = useState(false);
  const [resultData, setResultData] = useState(null);
  const [error, setError] = useState('');

  const fetchDataByUID = async (uidValue) => {
    try {
      const res = await axios.get(`${SERVER_URL}/personal/${encodeURIComponent(uidValue)}`);
      setName(uidValue);
      setResultData(res.data);
      setError('');
    } catch (err) {
      setResultData(null);
      setError('❌ לא נמצאו נתונים עבור הצמיד הזה');
    }
  };

  const fetchDataByID = async () => {
    try {
      const res = await axios.get(`${SERVER_URL}/search-id/${idInput.trim()}`);
      const foundName = res.data.name;
      if (foundName) {
        fetchDataByUID(foundName);
      } else {
        setResultData(null);
        setError('❌ לא נמצאו נתונים עבור תעודת זהות זו');
      }
    } catch (err) {
      setResultData(null);
      setError('❌ שגיאה בחיפוש תעודת זהות');
    }
  };

  useEffect(() => {
    if (uid && uid.length > 3 && !isIdMode) {
      fetchDataByUID(uid);
    }
  }, [uid]);

  return (
    <div className="live-board">
      <h2>📋 צפייה בתוצאות אישיות</h2>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={() => setIsIdMode(!isIdMode)}>
          {isIdMode ? '🔄 עבור לסריקת צמיד' : '🔍 עבור לחיפוש לפי תעודת זהות'}
        </button>
      </div>

      {isIdMode ? (
        <div>
          <input
            type="text"
            placeholder="הכנס תעודת זהות"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
          />
          <button onClick={fetchDataByID}>חפש</button>
        </div>
      ) : (
        <p>🔄 סרוק את הצמיד לצפייה בתוצאות</p>
      )}

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {resultData && (
        <div>
          <h3>שם: {resultData.name}</h3>
          <p>סה״כ ניקוד: {resultData.totalScore}</p>
          <p>מסלולים מוצלחים: {resultData.successCount} / 7</p>
          <table>
            <thead>
              <tr>
                <th>מסלול</th>
                <th>ניקוד</th>
                <th>ניסיונות</th>
              </tr>
            </thead>
            <tbody>
              {resultData.routes.map((route, idx) => (
                <tr key={idx}>
                  <td>{route.route}</td>
                  <td>{route.score}</td>
                  <td>{route.attempts === '❌' ? '❌' : `${route.attempts} ניסיונות`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default NfcPersonalScanner;
