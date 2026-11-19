// The current ticket backend: this app's own MySQL tables, via Sequelize.
// This is one implementation of the TicketStore contract described in
// ./index.js -- plugging in a different CRM (Zendesk, ServiceNow, a
// different institution's system) later means writing a new file with
// this same shape and registering it, not touching the controller.
//
// Every method here takes and returns plain data -- filter objects and
// plain ticket objects -- never a live Sequelize instance. That's what
// keeps the boundary real: a REST-backed provider couldn't hand back a
// "mutate me then call .save()" object, so this one doesn't either, even
// though it's free to internally.

const { Op, Transaction } = require('sequelize');
const { Ticket, User, sequelize } = require('../../models');
const { pickLeastBusyAgent } = require('../routingService');
const { PRIORITIES } = require('../../utils/ticketFields');

// Most urgent first: Critical (P1) ... Trivial. Built from the fixed
// PRIORITIES list, never from request input, so the literal is safe.
const PRIORITY_RANK = sequelize.literal(
  `FIELD(\`Ticket\`.\`priority\`, ${[...PRIORITIES]
    .reverse()
    .map((p) => sequelize.escape(p))
    .join(', ')})`
);
const FINISHED_LAST = sequelize.literal(
  "CASE WHEN `Ticket`.`status` IN ('Resolved', 'Closed') THEN 1 ELSE 0 END"
);

// sort = 'priority' is the agent work queue: open tickets first, then
// P1 to P4, then the closest resolution deadline, then the oldest.
// sort = 'newest' (the default) is newest first.
// createdAt only has second-level precision, so ties are common under
// fast/concurrent creation; id as a final key keeps pagination stable
// instead of leaving tied rows in an arbitrary order that can shift
// between requests.
const ORDERS = {
  newest: [
    ['createdAt', 'DESC'],
    ['id', 'DESC'],
  ],
  priority: [
    [FINISHED_LAST, 'ASC'],
    [PRIORITY_RANK, 'ASC'],
    ['dueAt', 'ASC'],
    ['createdAt', 'ASC'],
    ['id', 'ASC'],
  ],
};

const personIncludes = [
  {
    model: User,
    as: 'requester',
    attributes: ['id', 'name', 'email', 'role', 'organization'],
  },
  {
    model: User,
    as: 'assignee',
    attributes: ['id', 'name', 'email', 'role'],
    required: false,
  },
];

const summaryIncludes = [
  { model: User, as: 'requester', attributes: ['id', 'name'] },
  { model: User, as: 'assignee', attributes: ['id', 'name'], required: false },
];

// Translates the store's CRM-agnostic filter shape into a Sequelize where
// clause. assigneeIn specifically needs Op.or (not Op.in) because SQL's
// IN never matches a NULL member -- this is how "assigned to me or
// unassigned" has to be expressed, and every other provider would need
// its own equivalent for that same rule.
function buildWhere(filter = {}) {
  const where = {};
  const andConditions = [];

  if (filter.assigneeIn !== undefined) {
    andConditions.push({ [Op.or]: filter.assigneeIn.map((value) => ({ assigneeId: value })) });
  }
  if (filter.requesterId !== undefined) where.requesterId = filter.requesterId;
  if (filter.assigneeId !== undefined) where.assigneeId = filter.assigneeId;
  if (filter.status !== undefined) where.status = filter.status;
  if (filter.priority !== undefined) where.priority = filter.priority;
  if (filter.category !== undefined) where.category = filter.category;
  if (filter.organization !== undefined) where.organization = filter.organization;
  if (filter.dueBefore !== undefined) where.dueAt = { [Op.lt]: filter.dueBefore };
  if (filter.statusNotIn !== undefined) where.status = { [Op.notIn]: filter.statusNotIn };

  return andConditions.length > 0 ? { ...where, [Op.and]: andConditions } : where;
}

async function createTicket(data) {
  // Assignment and creation share one transaction so concurrent requests
  // don't all pick the same least-busy agent.
  const ticket = await sequelize.transaction(
    { isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE },
    async (transaction) => {
      const assigneeId = await pickLeastBusyAgent(transaction);
      return Ticket.create({ ...data, assigneeId }, { transaction });
    }
  );

  return ticket.get({ plain: true });
}

async function getTicketById(id) {
  const ticket = await Ticket.findByPk(id, { include: personIncludes });
  return ticket ? ticket.get({ plain: true }) : null;
}

async function listTickets(filter, { limit, offset, sort } = {}) {
  const { rows, count } = await Ticket.findAndCountAll({
    where: buildWhere(filter),
    order: ORDERS[sort] || ORDERS.newest,
    limit,
    offset,
    include: summaryIncludes,
  });

  return { rows: rows.map((row) => row.get({ plain: true })), count };
}

async function getOverdueTickets(filter) {
  const rows = await Ticket.findAll({
    where: buildWhere(filter),
    // Same tie-break rationale as listTickets -- dueAt is derived from
    // priority + createdAt, so same-priority tickets created in the same
    // second share an identical dueAt.
    order: [
      ['dueAt', 'ASC'],
      ['id', 'ASC'],
    ],
    include: summaryIncludes,
  });

  return rows.map((row) => row.get({ plain: true }));
}

async function updateTicket(id, changes) {
  const ticket = await Ticket.findByPk(id);
  if (!ticket) return null;

  Object.assign(ticket, changes);
  await ticket.save();
  await ticket.reload({ include: personIncludes });

  return ticket.get({ plain: true });
}

function createLocalSequelizeProvider() {
  return {
    createTicket,
    getTicketById,
    listTickets,
    getOverdueTickets,
    updateTicket,
  };
}

module.exports = { createLocalSequelizeProvider };
