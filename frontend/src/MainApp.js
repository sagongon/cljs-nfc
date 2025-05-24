
import React, { useEffect, useState } from 'react';
import './App.css';

const SERVER_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000';
const categoryOrder = ['E','DM','DF','CM','CF','BM','BF','AM','AF','JM','JF','M','F'];

const MainApp = () => {
  const [competitorsFull, setCompetitorsFull] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [extraCompetitors, setExtraCompetitors] = useState([]);
  const [showCatSelector, setShowCatSelector] = useState(false);
  const [filteredNames, setFilteredNames] = useState([]);
  const [newExtra, setNewExtra] = useState('');
  const [selectedName, setSelectedName] = useState('');
  const [routeNumber, setRouteNumber] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  useEffect(() => {
    fetch(`${SERVER_URL}/refresh`)
      .then(res => res.json())
      .then(() => fetch(`${SERVER_URL}/live`))
      .then(res => res.json())
      .then(data => {
        const cats = Object.keys(data);
        const sortedCats = categoryOrder.filter(cat => cats.includes(cat));
        setCategories(sortedCats);
        const full = [];
        cats.forEach(cat =>
          data[cat].forEach(comp =>
            full.push({ name: comp.name, category: cat })
          )
        );
        setCompetitorsFull(full);
      })
      .catch(err => console.error('❌ שגיאה בשחזור או בשליפת מתחרים:', err));
  }, []);

  useEffect(() => {
    let names = competitorsFull
      .filter(c => selectedCategories.includes(c.category) || extraCompetitors.includes(c.name))
      .map(c => c.name);
    if (!selectedCategories.length && !extraCompetitors.length) {
      names = competitorsFull.map(c => c.name);
    }
    setFilteredNames(Array.from(new Set(names)).sort());
  }, [competitorsFull, selectedCategories, extraCompetitors]);

  const handleAddExtra = () => {
    if (newExtra && !extraCompetitors.includes(newExtra)) {
      setExtraCompetitors(prev => [...prev, newExtra]);
      setNewExtra('');
    }
  };

  const renderTwoColumnCategories = () => {
    const half = Math.ceil(categories.length / 2);
    const col1 = categories.filter((_, i) => i % 2 === 0);
    const col2 = categories.filter((_, i) => i % 2 === 1);
    return (
      <div className="category-columns">
        <div className="category-column">
          {col1.map(cat => (
            <button
              key={cat}
              className={`category-btn ${selectedCategories.includes(cat) ? 'selected' : ''}`}
              onClick={() => setSelectedCategories(prev =>
                prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
              )}
            >
              {cat}
            </button>
          ))}
        </div>
        <div className="category-column">
          {col2.map(cat => (
            <button
              key={cat}
              className={`category-btn ${selectedCategories.includes(cat) ? 'selected' : ''}`}
              onClick={() => setSelectedCategories(prev =>
                prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className='App'>
      <h2>🧗 מערכת שיפוט תחרות</h2>
      <button onClick={() => setIsRegisterMode(prev => !prev)}>
        {isRegisterMode ? 'עבור למצב שיפוט' : 'עבור למצב רישום'}
      </button>

      {isRegisterMode ? (
        <div>
          <h3>רישום מתחרה</h3>
          <p>בחר קטגוריה:</p>
          {renderTwoColumnCategories()}
        </div>
      ) : (
        <p>🔧 ממשק שיפוט יופיע כאן (נשאר ללא שינוי)</p>
      )}
    </div>
  );
};

export default MainApp;
