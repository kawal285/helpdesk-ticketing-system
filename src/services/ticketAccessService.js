const AppError = require('../utils/appError');
const { canAccessTicket } = require('../utils/ticketAccess');
const { getProvider } = require('./ticketProviders');

// Loads a ticket for the current user, or fails with 404.
//
// A ticket the user may not see gets exactly the same 404 as one that
// doesn't exist, so nobody can probe ids to learn which tickets exist.
// Every ticket and comment route that takes a ticket id goes through here.
async function findAccessibleTicket(user, ticketId) {
  const ticket = await getProvider().getTicketById(ticketId);

  if (!ticket || !canAccessTicket(user, ticket)) {
    throw new AppError('Ticket not found.', 404);
  }

  return ticket;
}

module.exports = { findAccessibleTicket };
