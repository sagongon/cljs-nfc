import React, { useEffect, useState } from "react";
import axios from "axios";
import ClimberTable from "./ClimberTable";
import ClimberScore from "./ClimberScore";

const NfcPersonalScanner = () => {
  const [searchValue, setSearchValue] = useState("");
  const [climberData, setClimberData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("waiting");

  const SERVER_URL =
    window.location.hostname === "localhost"
      ? "http://localhost:4000"
      : "https://personalliveresults.onrender.com";

  const fetchData = async (identifier) => {
    try {
      setLoading(true);
      setError("");
      setClimberData(null);

      const isId = /^\d{5,10}$/.test(identifier); // מזהה אם זו ת"ז או UID
      const endpoint = isId
        ? `${SERVER_URL}/search-id/${identifier}`
        : `${SERVER_URL}/personal/${identifier}`;

      const response = await axios.get(endpoint);

      if (response.data && response.data.success) {
        setClimberData(response.data);
        setMode("result");
      } else {
        setError("לא נמצאו נתונים עבור הצמיד הזה או תעודת הזהות.");
        setMode("error");
      }
    } catch (err) {
      setError("שגיאה בעת טעינת נתונים.");
      setMode("error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleNfc = async () => {
      try {
        if ("NDEFReader" in window) {
          const ndef = new window.NDEFReader();
          await ndef.scan();
          ndef.onreading = (event) => {
            const uid = event.serialNumber;
            if (uid) {
              fetchData(uid);
            } else {
              setError("לא התקבל UID.");
              setMode("error");
            }
          };
        } else {
          setError("מכשיר זה לא תומך ב־NFC.");
          setMode("error");
        }
      } catch (err) {
        setError("שגיאה בעת קריאת הצמיד.");
        setMode("error");
      }
    };

    handleNfc();
  }, []);

  const handleIdSearch = () => {
    if (searchValue.trim()) {
      fetchData(searchValue.trim());
    }
  };

  return (
    <div className="scanner-container">
      <h2>תצוגה אישית</h2>

      {mode === "waiting" && (
        <>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="הכנס תעודת זהות"
          />
          <button onClick={handleIdSearch}>חפש לפי ת.ז</button>
          <p>📳 סרוק את הצמיד או הזן תעודת זהות</p>
        </>
      )}

      {loading && <p>טוען נתונים...</p>}

      {error && (
        <p style={{ color: "red", fontWeight: "bold" }}>❌ {error}</p>
      )}

      {climberData && (
        <>
          <ClimberScore data={climberData} />
          <ClimberTable data={climberData} />
        </>
      )}
    </div>
  );
};

export default NfcPersonalScanner;
