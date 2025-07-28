import React, { useEffect, useState } from "react";
import axios from "axios";

const SERVER_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:4000"
    : "https://personalliveresults.onrender.com";

function NfcPersonalScanner() {
  const [data, setData] = useState(null);
  const [statusMessage, setStatusMessage] = useState("נא לסרוק צמיד או להזין תעודת זהות");
  const [idInput, setIdInput] = useState("");

  const handleUID = async (uid) => {
    try {
      setStatusMessage("🔄 טוען נתונים...");
      const response = await axios.get(`${SERVER_URL}/search-uid/${uid}`);
      if (response.data && response.data.name) {
        setData(response.data);
        setStatusMessage(null);
      } else {
        setStatusMessage("❌ לא נמצאו נתונים לצמיד זה");
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("❌ שגיאה בעת טעינת נתונים");
    }
  };

  const handleIdSearch = async () => {
    if (!idInput.trim()) {
      setStatusMessage("❗ יש להזין תעודת זהות");
      return;
    }
    try {
      setStatusMessage("🔄 טוען נתונים...");
      const response = await axios.get(`${SERVER_URL}/search-id/${idInput.trim()}`);
      if (response.data && response.data.name) {
        setData(response.data);
        setStatusMessage(null);
      } else {
        setStatusMessage("❌ תעודת זהות לא נמצאה");
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("❌ שגיאה בעת טעינת נתונים");
    }
  };

  useEffect(() => {
    // נסה לסרוק UID (למשתמשי טלפון עם NDEFReader)
    if ("NDEFReader" in window) {
      const reader = new window.NDEFReader();
      reader
        .scan()
        .then(() => {
          reader.onreading = (event) => {
            const uid = event.serialNumber;
            if (uid) {
              handleUID(uid);
            }
          };
        })
        .catch((err) => {
          console.warn("NFC scanning not supported:", err);
        });
    }
  }, []);

  return (
    <div style={{ direction: "rtl", padding: 20, textAlign: "center" }}>
      <h2>תצוגה אישית</h2>

      {!data && (
        <>
          <p>{statusMessage}</p>
          <input
            type="text"
            placeholder="הכנס תעודת זהות"
            value={idInput}
            onChange={(e) => setIdInput(e.target.value)}
            style={{ padding: "10px", fontSize: "16px", width: "250px", margin: "10px" }}
          />
          <br />
          <button onClick={handleIdSearch} style={{ padding: "10px 20px", fontSize: "16px" }}>
            חפש לפי ת.ז
          </button>
        </>
      )}

      {data && (
        <>
          <h3>שלום, {data.name}</h3>
          <p>קטגוריה: {data.category}</p>
          <p>מועדון: {data.club}</p>
          <table style={{ margin: "auto", marginTop: "20px", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ border: "1px solid #ccc", padding: "6px" }}>מסלול</th>
                <th style={{ border: "1px solid #ccc", padding: "6px" }}>ניסיונות</th>
                <th style={{ border: "1px solid #ccc", padding: "6px" }}>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {(data.routes || []).map((route, idx) => (
                <tr key={idx}>
                  <td style={{ border: "1px solid #ccc", padding: "6px" }}>{route.routeNumber}</td>
                  <td style={{ border: "1px solid #ccc", padding: "6px" }}>{route.attempts}</td>
                  <td style={{ border: "1px solid #ccc", padding: "6px" }}>
                    {route.success ? "✅" : "❌"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ marginTop: "15px" }}>
            הצלחת {data.routes.filter((r) => r.success).length} מתוך 7 מסלולים
          </p>
        </>
      )}
    </div>
  );
}

export default NfcPersonalScanner;
