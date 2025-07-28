import React, { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import axios from 'axios';
import './LiveBoard.css';

const SERVER_URL =
  window.location.hostname === 'localhost'
    ? 'http://localhost:4000'
    : 'https://personalliveresults.onrender.com';

const NfcPersonalScanner = () => {
  const { uid } = useParams();
  const location = useLocation();
  const [name, setName] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const id = searchParams.get('id');

    const fetchData = async () => {
      try {
        setLoading(true);

        // אם יש תעודת זהות – נחפש לפי ת"ז
        if (id) {
          const res = await axios.get(`${SERVER_URL}/search-id/${id}`);
          if (res.data && res.data.name) {
            setName(res.data.name);
          } else {
            setError('לא נמצא מתחרה עם תעודת זהות זו');
            setLoading(false);
          }
        }

        // אם אין שם עדיין – ננסה לפי UID מה־URL
        else if (uid) {
          const res = await axios.get(`${SERVER_URL}/search-uid/${uid}`);
          if (res.data && res.data.name) {
            setName(res.data.name);
          } else {
            setError('לא נמצא מתחרה עבור UID זה');
            setLoading(false);
          }
        }

        // אם אין ת"ז ואין UID
        else {
          setError('לא התקבל UID או תעודת זהות');
          setLoading(false);
        }
      } catch (err) {
        setError('שגיאה בקבלת נתוני המתחרה');
        setLoading(false);
      }
    };

    fetchData();
  }, [uid, location.search]);

  useEffect(() => {
    if (!name) return;
    const getResults = async () => {
      try {
        const res = await axios.get(`${SERVER_URL}/personal/${encodeURIComponent(name)}`);
        setData(res.data.routes || []);
        setLoading(false);
      } catch (err) {
        setError('שגיאה בטעינת תוצאות');
        setLoading(false);
      }
    };

    getResults();
  }, [name]);

  if (loading) return <div className="live-board">⏳ טוען נתונים...</div>;
  if (error) return <div className="live-board">❌ {error}</div>;
  if (!name) return <div className="live-board">🔄 אנא סרוק צמיד או הזן תעודת זהות</div>;

  const successfulRoutes = data.filter(r => r.success);
  const top7 = [...data]
    .filter(r => r.success)
    .sort((a, b) => b.score - a.score)
    .slice(0, 7);
  const top7Total = top7.reduce((sum, r) => sum + r.score, 0);

  return (
    <div className="live-board">
      <h2>🧗‍♂️ תוצאות אישיות עבור {name}</h2>
      <p>✅ הצלחות: {successfulRoutes.length} מתוך 7</p>
      <p>🏆 ניקוד כולל (7 הכי טובים): {top7Total}</p>

      <table>
        <thead>
          <tr>
            <th>מסלול</th>
            <th>ניסיונות</th>
            <th>ניקוד</th>
            <th>סטטוס</th>
          </tr>
        </thead>
        <tbody>
          {data.map((route, index) => (
