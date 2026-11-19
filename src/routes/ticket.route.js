const express = require('express');
const {
  createTicket,
  listTickets,
  getOverdueTickets,
  getSlaSummary,
  getSimilarTickets,
  getHandoffSummary,
  getTicket,
  updateTicket,
  updateTicketStatus,
  assignTicket,
  aiAnalyzeTicket,
  reviewTicketResolution,
} = require('../controllers/ticket.controller');
const {
  createTicketValidator,
  listTicketsValidator,
  ticketIdValidator,
  updateTicketValidator,
  updateTicketStatusValidator,
  assignTicketValidator,
} = require('../validators/ticket.validators');
const validate = require('../middleware/validate');
const protect = require('../middleware/protect');
const authorize = require('../middleware/authorize');
const { aiLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.use(protect);

router.post('/', createTicketValidator, validate, createTicket);
router.get('/', listTicketsValidator, validate, listTickets);
// Same filter validation as the list (status, page and limit are ignored here).
router.get('/overdue', listTicketsValidator, validate, getOverdueTickets);
router.get('/sla-summary', listTicketsValidator, validate, getSlaSummary);
router.get(
  '/handoff-summary',
  authorize('agent', 'admin'),
  listTicketsValidator,
  validate,
  getHandoffSummary
);
router.get('/:id', ticketIdValidator, validate, getTicket);
router.get(
  '/:id/similar',
  authorize('agent', 'admin'),
  ticketIdValidator,
  validate,
  getSimilarTickets
);
router.patch('/:id', updateTicketValidator, validate, updateTicket);
router.patch(
  '/:id/status',
  authorize('agent', 'admin'),
  updateTicketStatusValidator,
  validate,
  updateTicketStatus
);
router.patch(
  '/:id/assign',
  authorize('agent', 'admin'),
  assignTicketValidator,
  validate,
  assignTicket
);
router.post(
  '/:id/ai-analyze',
  authorize('agent', 'admin'),
  aiLimiter,
  ticketIdValidator,
  validate,
  aiAnalyzeTicket
);

router.patch(
  '/:id/review',
  ticketIdValidator,
  validate,
  reviewTicketResolution
);

module.exports = router;