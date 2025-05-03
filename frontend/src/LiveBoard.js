import React, { useEffect, useState } from 'react';
import './LiveBoard.css';

 const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';
  
const categoryColors = {
  E: 'red',
  CM: 'blue',
  CF: 'pink',
  BM: 'orange',
  BF: 'purple',
  AM: 'green',
  AF: 'teal',
  JM: 'gray',
  JF: 'gold',
  SM: 'brown',
  SF: 'black',
};

const LiveBoard = () => {
  const [rankings, setRankings] = useState({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${SERVER_URL}/live`);
        const data = await res.json();
        setRankings(data);
      } catch (err) {
        console.error('שגיאה בשליפת נתונים:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="live-board">
      <h2>📊 דירוג מתחרים בזמן אמת</h2>
      <div className="scroll-container">
        <div className="duplicated-content">
          {[...Array(2)].map((_, dupIdx) => (
            <React.Fragment key={dupIdx}>
              {Object.entries(rankings).map(([category, competitors]) => (
                <div
                  key={`${category}-${dupIdx}`}
                  className="category-block"
                  style={{
                    border: `2px solid ${categoryColors[category] || 'black'}`,
                  }}
                >
                  <h3 style={{ color: categoryColors[category] || 'black' }}>{category}</h3>
                  <table>
                    <thead>
                      <tr>
                        <th>מקום</th>
                        <th>שם</th>
                        <th>קטגוריה</th>
                        <th>מועדון</th>
                        <th>ניקוד</th>
                      </tr>
                    </thead>
                    <tbody>
                      {competitors.map((comp, index) => (
                        <tr key={`${comp.name}-${dupIdx}`}>
                          <td>{index + 1}</td>
                          <td>{comp.name}</td>
                          <td>{comp.category}</td>
                          <td>{comp.club}</td>
                          <td>{comp.totalScore || comp.score || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LiveBoard;
