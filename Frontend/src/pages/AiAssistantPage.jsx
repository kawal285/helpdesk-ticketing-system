import { useState } from 'react';

export default function AiAssistantPage({ onCreateTicket }) {
  const [question, setQuestion] = useState('');
  const [assistant, setAssistant] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleAskAssistant(event) {
    event.preventDefault();

    if (!question.trim()) {
      setError('Please describe your IT problem.');
      return;
    }

    setLoading(true);
    setError('');
    setAssistant(null);

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        'http://localhost:4000/ai/assist',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            question: question.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || 'The AI assistant could not answer your question.'
        );
      }

      setAssistant(data.assistant);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  const cardStyle = {
    background: '#ffffff',
    borderRadius: 14,
    padding: 28,
    boxShadow: '0 6px 20px rgba(0, 50, 90, 0.12)',
    marginBottom: 22,
  };

  const labelStyle = {
    display: 'inline-block',
    background: '#e9f3fa',
    color: '#005a9c',
    borderRadius: 20,
    padding: '6px 12px',
    marginRight: 8,
    marginBottom: 8,
    fontWeight: 600,
    fontSize: 14,
  };

  return (
    <div
      style={{
        maxWidth: 850,
        margin: '40px auto',
        padding: '0 20px',
        fontFamily: 'sans-serif',
      }}
    >
      <div style={cardStyle}>
        <div
          style={{
            borderLeft: '6px solid #a8d500',
            paddingLeft: 18,
            marginBottom: 24,
          }}
        >
          <h1
            style={{
              color: '#005a9c',
              fontSize: 42,
              margin: '0 0 8px',
            }}
          >
            AI Help Assistant
          </h1>

          <p style={{ color: '#4f5965', margin: 0, lineHeight: 1.5 }}>
            Search approved Otago Polytechnic IT guidance before creating
            a support ticket.
          </p>
        </div>

        <form onSubmit={handleAskAssistant}>
          <label
            htmlFor="ai-question"
            style={{
              display: 'block',
              fontWeight: 700,
              color: '#003b64',
              marginBottom: 8,
            }}
          >
            Describe your IT problem
          </label>

          <textarea
            id="ai-question"
            rows={6}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="For example: The office printer is not printing. What should I do?"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: 14,
              borderRadius: 8,
              border: '1px solid #b8c5ce',
              fontFamily: 'inherit',
              fontSize: 16,
              resize: 'vertical',
            }}
          />

          {error && (
            <div
              style={{
                color: '#a61b1b',
                background: '#fff1f1',
                padding: 12,
                borderRadius: 8,
                marginTop: 12,
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 16,
              background: loading ? '#8296a3' : '#005a9c',
              color: '#ffffff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 22px',
              fontSize: 16,
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Searching approved guidance…' : 'Ask AI Assistant'}
          </button>
        </form>
      </div>

      {assistant && (
        <div style={cardStyle}>
          <h2 style={{ color: '#005a9c', marginTop: 0 }}>
            Suggested guidance
          </h2>

          <p
            style={{
              color: '#27313a',
              lineHeight: 1.7,
              whiteSpace: 'pre-wrap',
            }}
          >
            {assistant.answer}
          </p>

          <div style={{ marginTop: 18 }}>
            {assistant.suggestedCategory && (
              <span style={labelStyle}>
                Category: {assistant.suggestedCategory}
              </span>
            )}

            {assistant.suggestedPriority && (
              <span style={labelStyle}>
                Priority: {assistant.suggestedPriority}
              </span>
            )}
          </div>

          {assistant.knowledgeBaseMatch && assistant.source && (
            <div
              style={{
                background: '#f3f8ec',
                borderLeft: '5px solid #a8d500',
                padding: 14,
                marginTop: 18,
              }}
            >
              <strong>Approved source:</strong> {assistant.source.title}
            </div>
          )}

          {!assistant.knowledgeBaseMatch && (
            <div
              style={{
                background: '#fff6e8',
                borderLeft: '5px solid #e79b2f',
                padding: 14,
                marginTop: 18,
              }}
            >
            <strong>General AI guidance:</strong> No approved knowledge-base
             article matched this question. Try the suggested steps carefully.
              If the problem continues, create a ticket for the IT team.
             
            </div>
          )}

          <button
            type="button"
            onClick={() => onCreateTicket(question, assistant)}
            style={{
              marginTop: 20,
              background: assistant.shouldCreateTicket
                ? '#a8d500'
                : '#ffffff',
              color: assistant.shouldCreateTicket
                ? '#173500'
                : '#005a9c',
              border: '2px solid #005a9c',
              borderRadius: 8,
              padding: '11px 20px',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {assistant.shouldCreateTicket
              ? 'Create Support Ticket'
              : 'Still need help? Create a ticket'}
          </button>
        </div>
      )}
    </div>
  );
}