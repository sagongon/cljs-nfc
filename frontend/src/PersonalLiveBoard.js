import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import './LiveBoard.css';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';

const PersonalLiveBoard = () => {
  const { name } = useParams();
  const [attempts, setAttempts] = useState([]);
  const [score, setScore] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/personal/${encodeURIComponent(name)}`);
        const data = await res.json();
        setAttempts(data.attempts);
        setScore(data.totalScore);
      } catch (err) {
        console.error('שגיאה בשליפת נתונים:', err);
      }
    };

    fetchData();
  }, [name]);

  return (
    <div className="live-board">
      <h2>תוצאות אישיות: {name}</h2>
      <h3>ניקוד מצטבר: {score}</h3>
      <table>
        <thead>
          <tr>
            <th>מסלול</th>
            <th>סטטוס</th>
            <th>ניסיונות</th>
            <th>הערה</th>
          </tr>
        </thead>
        <tbody>
          {attempts.map(({ route, status, tries, note }) => (
            <tr key={route}>
              <td>{route}</td>
              <td>{status}</td>
              <td>{tries}</td>
              <td>{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PersonalLiveBoard;
