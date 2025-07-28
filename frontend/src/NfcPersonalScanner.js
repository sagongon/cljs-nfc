import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useParams, useSearchParams } from 'react-router-dom';

const SERVER = 'https://personalliveresults.onrender.com';

export default function NfcPersonalScanner() {
  const { uid } = useParams();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('id');
  const [data, setData] = useState(null);
  const [tz, setTz] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const value = uid || id;

  useEffect(() => {
    if (!value) return;
    setLoading(true);
    axios
      .get(`${SERVER}/search-id/${value}`)
      .then((res) => {
        setData(res.data);
        setError('');
      })
      .catch(() => {
        setError('לא נמצאו נתונים עבור הצמיד הזה.');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [value]);

  const handleSearch = () => {
    if (!tz) return;
    window.location.href = `/nfc-personal-scanner?id=${tz}`;
  };

  if (!uid && !id) {
    return (
      <div style={{ textAlign: 'center', marginTop: '50px' }}>
        <h2>🔍 תצוגת תוצאות אישיות</h2>
        <p style={{ color: '#66ffff' }}>הזן תעודת זהות:</p>
        <input
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          placeholder="הקלד ת.ז"
          style={{ padding: '10px', fontSize: '16px' }}
        />
        <br /><br />
        <button onClick={handleSearch} style={{ padding: '10px 20px', fontSize: '16px' }}>
          חפש לפי תעודת זהות
        </button>
        <p style={{ marginTop: '30px', color: 'gray' }}>או סרוק צמיד להצגת תוצאות</p>
      </div>
    );
  }

  if (loading) return <h3 style={{ textAlign: 'center' }}>טוען נתונים...</h3>;
  if (error) return <h3 style={{ color: 'red', textAlign: 'center' }}>❌ {error}</h3>;
  if (!data) return null;

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h2>📋 תוצאות של {data.name}</h2>
      <p>קטגוריה: {data.category}</p>
      <p>מועדון: {data.club}</p>
      <h3>ניקוד: {data.totalScore} נק׳ ({data.validRoutes.length}/7 מסלולים)</h3>

      <table style={{ margin: '0 auto', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr>
            <th>מסלול</th>
            <th>ניקוד</th>
            <th>ניסיונות</th>
            <th>סטטוס</th>
          </tr>
        </thead>
        <tbody>
          {data.routes.map((route) => (
            <tr key={route.number}>
              <td>{route.number}</td>
              <td>{route.score}</td>
              <td>{route.attempts}</td>
              <td>{route.success ? '✅' : '❌'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
