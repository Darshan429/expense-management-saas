// client/src/components/ExportButtons.jsx
const token = localStorage.getItem('token');

const downloadFile = async (format, params = '') => {
  const res = await fetch(`/api/export/${format}?${params}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    alert('Export failed — no data for selected filters');
    return;
  }

  // Create a temporary link and trigger download
  const blob     = await res.blob();
  const url      = window.URL.createObjectURL(blob);
  const link     = document.createElement('a');
  link.href      = url;
  link.download  = format === 'csv'
    ? `expenses_${Date.now()}.csv`
    : `expense_report_${Date.now()}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default function ExportButtons({ range = '30d', status, category }) {
  const params = new URLSearchParams(
    Object.fromEntries(
      Object.entries({ range, status, category }).filter(([,v]) => v)
    )
  ).toString();

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <button
        onClick={() => downloadFile('csv', params)}
        style={{
          padding:      '8px 16px',
          background:   '#1D9E75',
          color:        '#fff',
          border:       'none',
          borderRadius: 8,
          cursor:       'pointer',
          fontSize:     13,
          fontWeight:   500
        }}
      >
        Export CSV
      </button>

      <button
        onClick={() => downloadFile('pdf', params)}
        style={{
          padding:      '8px 16px',
          background:   '#378ADD',
          color:        '#fff',
          border:       'none',
          borderRadius: 8,
          cursor:       'pointer',
          fontSize:     13,
          fontWeight:   500
        }}
      >
        Export PDF
      </button>
    </div>
  );
}