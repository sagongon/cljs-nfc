import React, { useState } from 'react';

// 🟢 שרת ראשי (שיפוט) – כמו שעבדת עד היום
// קודם מנסים REACT_APP_PRIMARY_API_URL,
// אם אין – נופלים חזרה ל-REACT_APP_API_BASE_URL,
// ואם גם אין – עובדים מקומית מול localhost:4000
const PRIMARY_SERVER =
  process.env.REACT_APP_PRIMARY_API_URL ||
  process.env.REACT_APP_API_BASE_URL ||
  'http://localhost:4000';

// 🔵 שרת משני (תוצאות אישיות)
// חובה להגדיר ב-Vercel: REACT_APP_SECONDARY_API_URL
// אם לא מוגדר – נופל חזרה לשרת הראשי כדי לא לשבור כלום
const SECONDARY_SERVER =
  process.env.REACT_APP_SECONDARY_API_URL ||
  PRIMARY_SERVER;

export default function SpreadsheetSettings() {
  const [adminPassword, setAdminPassword] = useState('');
  const [sheetId, setSheetId] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setMessage('');

    if (!adminPassword || !sheetId) {
      setMessage('❌ יש למלא את כל השדות');
      return;
    }

    setIsLoading(true);

    try {
      console.log('PRIMARY_SERVER:', PRIMARY_SERVER);
      console.log('SECONDARY_SERVER:', SECONDARY_SERVER);

      const payload = {
        adminCode: adminPassword,
        newSheetId: sheetId,
      };

      const headers = { 'Content-Type': 'application/json' };

      // שולחים במקביל לשני השרתים
      const [primaryRes, secondaryRes] = await Promise.all([
        fetch(`${PRIMARY_SERVER}/set-active-sheet`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        }),
        fetch(`${SECONDARY_SERVER}/set-active-sheet`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        }),
      ]);

      const primaryData = await primaryRes.json().catch(() => ({}));
      const secondaryData = await secondaryRes.json().catch(() => ({}));

      const primaryOk = primaryRes.ok;
      const secondaryOk = secondaryRes.ok;

      if (primaryOk && secondaryOk) {
        setMessage('✅ מזהה הגיליון עודכן בהצלחה בשני השרתים!');
        setSheetId('');
        setAdminPassword('');
      } else if (primaryOk && !secondaryOk) {
        setMessage(
          `⚠️ עודכן רק בשרת הראשי. שגיאה בשרת המשני: ${
            secondaryData.error || 'לא ידוע'
          }`
        );
      } else if (!primaryOk && secondaryOk) {
        setMessage(
          `⚠️ עודכן רק בשרת המשני. שגיאה בשרת הראשי: ${
            primaryData.error || 'לא ידוע'
          }`
        );
      } else {
        setMessage(
          `❌ העדכון נכשל בשני השרתים. ראשי: ${
            primaryData.error || 'לא ידוע'
          }, משני: ${secondaryData.error || 'לא ידוע'}`
        );
      }
    } catch (err) {
      console.error('שגיאה בעדכון מזהה גיליון:', err);
      setMessage('❌ שגיאה כללית בעדכון מזהה הגיליון');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <h2>⚙️ ניהול מזהה גיליון</h2>

      <input
        type="password"
        placeholder="סיסמת מנהל"
        value={adminPassword}
        onChange={(e) => setAdminPassword(e.target.value)}
        className="admin-input"
        disabled={isLoading}
      />
      <input
        type="text"
        placeholder="Spreadsheet ID החדש"
        value={sheetId}
        onChange={(e) => setSheetId(e.target.value)}
        className="sheet-id-input"
        disabled={isLoading}
      />
      <button onClick={handleSubmit} disabled={isLoading}>
        {isLoading ? 'שומר...' : 'שמור גיליון חדש'}
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}
