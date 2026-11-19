// Plain explanations for why a ticket was handed to a person
// (matches src/utils/aiConfidence.js on the server).
export const HANDOFF_REASONS = {
  prompt_injection: 'The ticket tried to give the AI instructions.',
  ai_unavailable: 'The AI was not available when the ticket was created.',
  unclear_ai_priority: "The AI's priority answer could not be read.",
  unclear_ai_category: "The AI's category answer could not be read.",
  low_priority_confidence: 'The AI was not sure about the priority.',
  low_category_confidence: 'The AI was not sure about the category.',
  flagged_by_staff: 'A staff member asked for a check.',
};

export function reasonText(reason) {
  return HANDOFF_REASONS[reason] || reason;
}

export function percent(value) {
  return typeof value === 'number' ? `${Math.round(value * 100)}%` : '—';
}
