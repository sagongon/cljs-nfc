import React, { useEffect, useState } from "react";
import ClimberScore from "./ClimberScore";

const NfcPersonalScanner = () => {
  const [climberData, setClimberData] = useState(null);
  const [idNumber, setIdNumber] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const uid = searchParams.get("uid");

    if (uid) {
      fetchDataByUid(uid);
    }
  }, []);

  const fetchDataByUid = async (uid) => {
    try {
      const response = await fetch(
        "https://personalliveresults.onrender.com/search",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ uid }),
        }
      );

      const data = await response.json();
      setClimberData(data);
    } catch (err) {
      console.error("שגיאה בשליפת נתונים לפי UID:", err);
      setError("שגיאה בשליפת נתונים מהשרת.");
    }
  };

  const fetchDataById = async () => {
    setScanning(true);
    setError("");

    try {
      const response = await fetch(
        "https://personalliveresults.onrender.com/search-id",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ idNumber }),
        }
      );

      const data = await response.json();

      if (data && data.name) {
        setClimberData(data);
      } else {
        setError("לא נמצא מתחרה עם תעודת הזהות שהוזנה.");
        setClimberData(null);
      }
    } catch (err) {
      console.error("שגיאה בשליפת נתונים לפי תעודת זהות:", err);
      setError("שגיאה בשליפת נתונים מהשרת.");
      setClimberData(null);
    }

    setScanning(false);
  };

  return (
    <div className="nfc-scanner">
      <h2>תצוגה אישית למתחרה</h2>

      {!climberData && (
        <>
          <p>הכנס תעודת זהות לצפייה בתוצאות:</p>
          <input
            type="text"
            placeholder="תעודת זהות"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
          />
          <button onClick={fetchDataById} disabled={scanning}>
            {scanning ? "טוען..." : "הצג תוצאות"}
          </button>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </>
      )}

      {climberData && (
        <>
          <ClimberScore data={climberData} />
        </>
      )}
    </div>
  );
};

export default NfcPersonalScanner;
