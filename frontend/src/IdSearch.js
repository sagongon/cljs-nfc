import React, { useState } from 'react';

const IdSearch = () => {
  const [idInput, setIdInput] = useState('');
  const [error, setError] = useState('');

  const handleSearch = async () => {
    setError('');
    if (!idInput.trim()) {
      setError('אנא הזן תעודת זהות.');
      return;
    }
    try {
      const res = await fetch(`https://personalliveresults.onrender.com/search-id/${idInput}`);
      const data = await res.json();
      if (data.uid) {
        window.location.href = `/nfc-personal-scanner/${data.uid}`;
      } else {
        setError('תעודת זהות לא נמצאה במערכת.');
      }
    } catch (e) {
      setError('שגיאה בחיפוש. נסה שוב.');
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto text-center">
      <h2 className="text-xl font-bold mb-4">הצגת תוצאות אישיות לפי ת.ז</h2>
      <input
        type="text"
        placeholder="הכנס תעודת זהות"
        value={idInput}
        onChange={(e) => setIdInput(e.target.value)}
        className="border rounded p-2 w-full mb-4"
      />
      <button
        onClick={handleSearch}
        className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700"
      >
        חפש תוצאות
      </button>
      {error && <p className="text-red-600 mt-4">{error}</p>}
    </div>
  );
};

export default IdSearch;
