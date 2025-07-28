import React, { useEffect, useState } from "react";

const SERVER_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:9000"
    : "https://personalliveresults.onrender.com";

export default function NfcPersonalScanner() {
  const [searchValue, setSearchValue] = useState("");
  const [climberName, setClimberName] = useState(null);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchResults = async (type, value) => {
    try {
      setLoading(true);
      const res = await fetch(`${SERVER_URL}/search-${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [type === "uid" ? "uid" : "idNumber"]: value }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "שגיאה בטעינת נתונים");
      setClimberName(data.name);
      setResults(data.routes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!searchValue.trim()) return;
    const isID = /^\d{9}$/.test(searchValue);
    fetchResults(isID ? "id" : "uid", searchValue.trim());
  };

  const calculateTop7Score = (routes) => {
    const scores = routes
      .filter((r) => r.success)
      .map((r) => r.score)
      .sort((a, b) => b - a)
      .slice(0, 7);
    return scores.reduce((sum, val) => sum + val, 0);
  };

  return (
    <div style={{ direction: "rtl", textAlign: "center", padding: 20 }}>
      <h2>תוצאות ספורטאי לפי UID או תעודת זהות</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="הזן UID או ת.ז"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          style={{ padding: 10, width: "60%" }}
        />
        <button type="submit" style={{ padding: 10, marginRight: 10 }}>
          חפש
        </button>
      </form>

      {loading && <p>טוען נתונים...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      {results && (
        <div style={{ marginTop: 30 }}>
          <h3>{climberName} – סיכום אישי</h3>
          <p>
            הצלחות: {results.filter((r) => r.success).length} / 7<br />
            ניקוד כולל: {calculateTop7Score(results)}
          </p>
          <table
            style={{
              margin: "auto",
              borderCollapse: "collapse",
              width: "90%",
              marginTop: 20,
            }}
          >
            <thead>
              <tr>
                <th>מסלול</th>
                <th>ניסיונות</th>
                <th>הצלחה</th>
                <th>ניקוד</th>
              </tr>
            </thead>
            <tbody>
              {results.map((route, idx) => (
                <tr key={idx}>
                  <td>{route.route}</td>
                  <td>{route.attempts}</td>
                  <td>{route.success ? "✅" : "❌"}</td>
                  <td>{route.success ? route.score : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
