
import React, { useState } from 'react';
import './RouteSelector.css';

const RouteSelector = ({ onConfirm }) => {
  const [selected, setSelected] = useState([]);

  const toggleRoute = (route) => {
    if (selected.includes(route)) {
      setSelected(selected.filter((r) => r !== route));
    } else {
      setSelected([...selected, route]);
    }
  };

  const handleConfirm = () => {
    onConfirm(selected.sort((a, b) => a - b));
    setSelected([]);
  };

  return (
    <div className="route-selector">
      <h4>בחר מסלולים לשיפוט</h4>
      <div className="grid">
        {Array.from({ length: 50 }, (_, i) => i + 1).map((route) => (
          <button
            key={route}
            className={selected.includes(route) ? 'route-button selected' : 'route-button'}
            onClick={() => toggleRoute(route)}
          >
            {route}
          </button>
        ))}
      </div>
      <button className="confirm-button" onClick={handleConfirm}>שמור מסלולים</button>
    </div>
  );
};

export default RouteSelector;
