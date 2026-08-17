export default function ComingSoonPage({ title }) {
  return (
    <div style={{ maxWidth: 700, margin: '40px auto', padding: '0 20px', fontFamily: 'sans-serif' }}>
      <div
        style={{
          background: '#ffffff',
          borderRadius: 12,
          padding: 28,
          boxShadow: '0 4px 16px rgba(16, 20, 43, 0.08)',
        }}
      >
        <h1 style={{ marginTop: 0 }}>{title}</h1>
        <p style={{ color: '#656a7d' }}>This isn’t built yet — check back soon.</p>
      </div>
    </div>
  );
}
