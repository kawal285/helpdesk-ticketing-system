const express = require('express');
const {
  createTicket,
  listTickets,
  getOverdueTickets,
  getTicket,
  updateTicket,
  updateTicketStatus,
  assignTicket,
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

const router = express.Router();

router.use(protect);

router.post('/', createTicketValidator, validate, createTicket);
router.get('/', listTicketsValidator, validate, listTickets);
router.get('/overdue', getOverdueTickets);
router.get('/:id', ticketIdValidator, validate, getTicket);
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

module.exports = router;
