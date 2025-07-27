import React from 'react';

const links = [
  { label: '🧗 אפליקציית שיפוט', url: 'https://cljs-nfc-ashy.vercel.app/' },
  { label: '⏳ תור – תחנה 1', url: 'https://cljs-nfc-ashy.vercel.app/queue-scanner/1' },
  { label: '⏳ תור – תחנה 2', url: 'https://cljs-nfc-ashy.vercel.app/queue-scanner/2' },
  { label: '⏳ תור – תחנה 3', url: 'https://cljs-nfc-ashy.vercel.app/queue-scanner/3' },
  { label: '⏳ תור – תחנה 4', url: 'https://cljs-nfc-ashy.vercel.app/queue-scanner/4' },
  { label: '⏳ תור – תחנה 5', url: 'https://cljs-nfc-ashy.vercel.app/queue-scanner/5' },
  { label: '📊 דירוג בזמן אמת', url: 'https://cljs-nfc-ashy.vercel.app/live' },
  { label: '📲 צפייה בתוצאות אישיות (סריקת צמיד)', url: 'https://cljs-nfc-ashy.vercel.app/nfc-personal-scanner' },
  { label: '🔍 צפייה לפי תעודת זהות', url: 'https://cljs-nfc-ashy.vercel.app/id-search' },
];

export default function Menu() {
  return (
    <div style={{ padding: 20, textAlign: 'center', direction: 'rtl' }}>
      <h2>📱 תפריט ראשי</h2>
      {links.map(({ label, url }) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block',
            margin: '12px auto',
            padding: '16px',
            fontSize: '18px',
            backgroundColor: '#f0f0f0',
            borderRadius: '12px',
            textDecoration: 'none',
            color: '#333',
            width: '90%',
            maxWidth: '400px',
            boxShadow: '0 2px 6px rgba(0,0,0,0.1)',
          }}
        >
          {label}
        </a>
      ))}
    </div>
  );
}
