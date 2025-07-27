import React, { useState, useEffect } from 'react';

const SERVER_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:4000'
    : 'https://cljs-nfc.onrender.com'; // ודא שזו הכתובת של השרת הראשי

function NfcPersonalScanner() {
  const [uid, setUid] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [name, setName] = useState('');
  const [attempts, setAttempts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchNameFromUID = async (givenUid) => {
    try {
      const res = await fetch(`${SERVER_URL}/nfc-name/${givenUid}`);
      const data = await res.json();
      if (res.ok) {
        setName(data.name);
      } else {
        setError(data.error || 'שגיאה בזיהוי שם לפי UID');
      }
    } catch (err) {
      setError('שגיאה בתקשורת עם השרת');
    }
  };

  const fetchAttempts = async (givenName) => {
    try {
      const res = await fetch(`${SERVER_URL}/personal/${encodeURIComponent(givenName)}`);
      const data = await res.json();
      if (res.ok) {
        setAttempts(data.attempts || []);
      } else {
        setError(data.error || 'שגיאה בשליפת נתונים');
      }
    } catch (err) {
      setError('שגיאה בתקשורת עם השרת');
    }
  };

  const handleSearchById = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/search-id/${idNumber.trim()}`);
      const data = await res.json();
      if (res.ok && data.uid) {
        setUid(data.uid);
        fetchNameFromUID(data.uid);
      } else {
        setError(data.error || 'לא נמצא UID תואם');
      }
    } catch (err) {
      setError('שגיאה בתקשורת עם השרת');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (name) {
      fetchAttempts(name);
    }
  }, [name]);

  return (
    <div className="App">
      <h2>🔍 תצוגת תוצאות אישיות</h2>

      <div>
        <label>או הזן תעודת זהות:</label>
        <input
          type="text"
          value={idNumber}
          onChange={(e) => setIdNumber(e.target.value)}
          placeholder="הקלד ת"ז"
        />
        <button onClick={handleSearchById} disabled={loading}>
          חפש לפי תעודת זהות
        </button>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {name && (
        <div>
          <h3>שלום {name} 👋</h3>
          <h4>תוצאות:</h4>
          <ul>
            {attempts.map((a, idx) => (
              <li key={idx}>
                מסלול {a.route}: {a.success ? `✅ ${a.tries} ניסיונות` : `❌ ${a.tries} ניסיונות`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default NfcPersonalScanner;
