
import React, { useEffect, useState } from 'react';
import './App.css';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';
const categoryOrder = ['E','DM','DF','CM','CF','BM','BF','AM','AF','JM','JF','M','F'];

const MainApp = () => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [showCatSelector, setShowCatSelector] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [competitorsByCategory, setCompetitorsByCategory] = useState({});
  const [selectedName, setSelectedName] = useState('');
  const [multiNames, setMultiNames] = useState([]);

  useEffect(() => {
    fetch(`${SERVER_URL}/competitors-by-category`)
      .then(res => res.json())
      .then(data => {
        const normalized = {};
        categoryOrder.forEach(cat => {
          const serverKey = cat === 'M' ? 'SM' : cat === 'F' ? 'SF' : cat;
          normalized[cat] = data[serverKey] || [];
        });
        setCompetitorsByCategory(normalized);
      });
  }, []);

  const toggleCategory = (cat) => {
    setSelectedCategories(prev =>
      prev.includes(cat)
        ? prev.filter(c => c !== cat)
        : [...prev, cat]
    );
  };

  return (
    <div className="App">
      <h2>מערכת שיפוט תחרות 🧗‍♂️</h2>
      <button onClick={() => setIsRegisterMode(!isRegisterMode)}>
        {isRegisterMode ? 'עבור למצב שיפוט' : 'עבור למצב רישום'}
      </button>

      {isRegisterMode ? (
        <>
          <h3>רישום מתחרה</h3>
          <div className="category-selector">
            {categoryOrder.map(cat => (
              <button
                key={cat}
                className={`category-btn ${selectedCategories.includes(cat) ? 'selected' : ''}`}
                onClick={() => toggleCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button onClick={() => setShowCatSelector(!showCatSelector)}>
            {showCatSelector ? 'סגור קטגוריות' : 'בחירת קטגוריות'}
          </button>

          {showCatSelector && (
            <div className="category-selector">
              {categoryOrder.map(cat => (
                <button
                  key={cat}
                  className={`category-btn ${selectedCategories.includes(cat) ? 'selected' : ''}`}
                  onClick={() => toggleCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          <div className="multiple-competitors">
            <button onClick={() => setMultiNames([...multiNames, ''])}>הוסף מתחרה נוסף</button>
            {multiNames.map((_, i) => (
              <div key={i}>
                <input
                  value={multiNames[i]}
                  onChange={e => {
                    const copy = [...multiNames];
                    copy[i] = e.target.value;
                    setMultiNames(copy);
                  }}
                />
                <button onClick={() => {
                  const copy = [...multiNames];
                  copy.splice(i, 1);
                  setMultiNames(copy);
                }}>הסר</button>
              </div>
            ))}
            <button onClick={() => setMultiNames([])}>נקה נוספים</button>
          </div>
        </>
      )}
    </div>
  );
};

export default MainApp;
