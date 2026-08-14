const { sendEmail } = require('./emailService');

const STATUS_LABELS = {
  Open: 'Open',
  'In Progress': 'In Progress',
  Resolved: 'Resolved – Awaiting Your Review',
  Closed: 'Reviewed and Closed',
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ticketReference(ticket) {
  return `TK-${ticket.id}`;
}

function ticketUrl(ticket) {
  const frontendUrl =
    process.env.FRONTEND_URL ||
    'http://localhost:5173';

  /*
   * The current React application uses internal state rather than
   * URL routing. This URL opens the portal. The user can then select
   * the ticket from their ticket list.
   */
  return `${frontendUrl}`;
}

function formatDate(value) {
  if (!value) return 'Not available';

  return new Date(value).toLocaleString('en-NZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Pacific/Auckland',
  });
}

function createEmailLayout({
  heading,
  introduction,
  ticket,
  additionalContent = '',
}) {
  const reference = escapeHtml(
    ticketReference(ticket)
  );

  const title = escapeHtml(ticket.title);

  const status = escapeHtml(
    STATUS_LABELS[ticket.status] || ticket.status
  );

  const priority = escapeHtml(ticket.priority);

  const category = escapeHtml(ticket.category);

  const dueDate = escapeHtml(
    formatDate(ticket.dueAt)
  );

  const portalUrl = escapeHtml(ticketUrl(ticket));

  return `
    <div
      style="
        margin:0;
        padding:24px;
        background:#f2f4f7;
        font-family:Arial,sans-serif;
        color:#1b1e2b;
      "
    >
      <div
        style="
          max-width:640px;
          margin:0 auto;
          background:#ffffff;
          border-top:6px solid #f37021;
          border-radius:10px;
          overflow:hidden;
        "
      >
        <div
          style="
            padding:24px;
            background:#005a9c;
            color:#ffffff;
          "
        >
          <h1 style="margin:0;font-size:24px;">
            OP IT Helpdesk
          </h1>

          <p style="margin:6px 0 0;">
            Support and Ticketing Portal
          </p>
        </div>

        <div style="padding:26px;">
          <h2
            style="
              margin:0 0 14px;
              color:#003b70;
            "
          >
            ${escapeHtml(heading)}
          </h2>

          <p style="line-height:1.6;">
            ${escapeHtml(introduction)}
          </p>

          <div
            style="
              margin:20px 0;
              padding:18px;
              background:#f7f9fb;
              border-left:5px solid #f37021;
              border-radius:6px;
            "
          >
            <p style="margin:0 0 8px;">
              <strong>Ticket:</strong>
              ${reference}
            </p>

            <p style="margin:0 0 8px;">
              <strong>Title:</strong>
              ${title}
            </p>

            <p style="margin:0 0 8px;">
              <strong>Status:</strong>
              ${status}
            </p>

            <p style="margin:0 0 8px;">
              <strong>Priority:</strong>
              ${priority}
            </p>

            <p style="margin:0 0 8px;">
              <strong>Category:</strong>
              ${category}
            </p>

            <p style="margin:0;">
              <strong>Target date:</strong>
              ${dueDate}
            </p>
          </div>

          ${additionalContent}

          <p style="margin-top:24px;">
            <a
              href="${portalUrl}"
              style="
                display:inline-block;
                padding:12px 18px;
                color:#ffffff;
                background:#005a9c;
                border-radius:5px;
                font-weight:bold;
                text-decoration:none;
              "
            >
              Open Helpdesk Portal
            </a>
          </p>

          <p
            style="
              margin-top:24px;
              color:#656a7d;
              font-size:12px;
              line-height:1.5;
            "
          >
            This is an automated notification from the OP IT
            Helpdesk. Please do not share your login password by
            email.
          </p>
        </div>
      </div>
    </div>
  `;
}

async function safelySendEmail(message) {
  try {
    return await sendEmail(message);
  } catch (error) {
    /*
     * An email provider failure must not prevent ticket creation,
     * assignment, comments or status updates.
     */
    console.error(
      `Helpdesk notification failed: ${error.message}`
    );

    return {
      skipped: true,
      reason: 'send-failed',
      error: error.message,
    };
  }
}

async function notifyTicketCreated({
  ticket,
  requester,
}) {
  if (!requester?.email) return;

  const reference = ticketReference(ticket);

  return safelySendEmail({
    to: requester.email,

    subject:
      `[${reference}] Your support ticket was created`,

    text:
      `Hello ${requester.name},\n\n` +
      `Your support ticket ${reference} has been created.\n` +
      `Title: ${ticket.title}\n` +
      `Status: ${STATUS_LABELS[ticket.status] || ticket.status}\n` +
      `Priority: ${ticket.priority}\n` +
      `Target date: ${formatDate(ticket.dueAt)}\n\n` +
      `Open the helpdesk portal: ${ticketUrl(ticket)}`,

    html: createEmailLayout({
      heading: 'Support ticket created',
      introduction:
        `Hello ${requester.name}, your support request has been received.`,
      ticket,
    }),
  });
}

async function notifyTicketAssigned({
  ticket,
  requester,
  assignee,
}) {
  const reference = ticketReference(ticket);

  const jobs = [];

  if (requester?.email) {
    jobs.push(
      safelySendEmail({
        to: requester.email,

        subject:
          `[${reference}] A support agent was assigned`,

        text:
          `Hello ${requester.name},\n\n` +
          `${assignee?.name || 'A support agent'} was assigned to ${reference}.\n` +
          `Agent email: ${assignee?.email || 'Not available'}\n` +
          `Target date: ${formatDate(ticket.dueAt)}\n\n` +
          `Open the helpdesk portal: ${ticketUrl(ticket)}`,

        html: createEmailLayout({
          heading: 'Support agent assigned',
          introduction:
            `${assignee?.name || 'A support agent'} has been assigned to your ticket.`,
          ticket,
          additionalContent: assignee
            ? `
              <p>
                <strong>Assigned agent:</strong>
                ${escapeHtml(assignee.name)}
              </p>

              <p>
                <strong>Agent email:</strong>
                ${escapeHtml(assignee.email)}
              </p>
            `
            : '',
        }),
      })
    );
  }

  if (assignee?.email) {
    jobs.push(
      safelySendEmail({
        to: assignee.email,

        subject:
          `[${reference}] Ticket assigned to you`,

        text:
          `Hello ${assignee.name},\n\n` +
          `${reference} was assigned to you.\n` +
          `Title: ${ticket.title}\n` +
          `Priority: ${ticket.priority}\n` +
          `Target date: ${formatDate(ticket.dueAt)}\n\n` +
          `Open the helpdesk portal: ${ticketUrl(ticket)}`,

        html: createEmailLayout({
          heading: 'A ticket was assigned to you',
          introduction:
            `Hello ${assignee.name}, a support ticket requires your attention.`,
          ticket,
          additionalContent: requester
            ? `
              <p>
                <strong>Requester:</strong>
                ${escapeHtml(requester.name)}
              </p>

              <p>
                <strong>Requester email:</strong>
                ${escapeHtml(requester.email)}
              </p>
            `
            : '',
        }),
      })
    );
  }

  return Promise.allSettled(jobs);
}

async function notifyStatusChanged({
  ticket,
  requester,
}) {
  if (!requester?.email) return;

  const reference = ticketReference(ticket);

  return safelySendEmail({
    to: requester.email,

    subject:
      `[${reference}] Status changed to ${
        STATUS_LABELS[ticket.status] ||
        ticket.status
      }`,

    text:
      `Hello ${requester.name},\n\n` +
      `The status of ${reference} changed to ` +
      `${STATUS_LABELS[ticket.status] || ticket.status}.\n\n` +
      `Open the helpdesk portal: ${ticketUrl(ticket)}`,

    html: createEmailLayout({
      heading: 'Ticket status updated',
      introduction:
        `Your ticket status changed to ${
          STATUS_LABELS[ticket.status] ||
          ticket.status
        }.`,
      ticket,
    }),
  });
}

async function notifyCommentAdded({
  ticket,
  recipient,
  author,
  comment,
}) {
  if (!recipient?.email) return;

  const reference = ticketReference(ticket);

  return safelySendEmail({
    to: recipient.email,

    subject:
      `[${reference}] New comment from ${author.name}`,

    text:
      `Hello ${recipient.name},\n\n` +
      `${author.name} added a comment to ${reference}:\n\n` +
      `${comment.text}\n\n` +
      `Open the helpdesk portal: ${ticketUrl(ticket)}`,

    html: createEmailLayout({
      heading: 'New ticket comment',
      introduction:
        `${author.name} added a comment to your ticket.`,
      ticket,
      additionalContent: `
        <div
          style="
            margin:18px 0;
            padding:16px;
            background:#eaf4fa;
            border-left:4px solid #005a9c;
            border-radius:5px;
            line-height:1.6;
          "
        >
          ${escapeHtml(comment.text)}
        </div>
      `,
    }),
  });
}

async function notifyResolutionReviewed({
  ticket,
  assignee,
  action,
}) {
  if (!assignee?.email) return;

  const reference = ticketReference(ticket);

  const accepted = action === 'accept';

  return safelySendEmail({
    to: assignee.email,

    subject: accepted
      ? `[${reference}] Resolution accepted`
      : `[${reference}] Customer requested more help`,

    text: accepted
      ? `The customer accepted the resolution for ${reference}. The ticket is now closed.`
      : `The customer reported that ${reference} is not resolved. The ticket has returned to In Progress.`,

    html: createEmailLayout({
      heading: accepted
        ? 'Resolution accepted'
        : 'Ticket reopened',
      introduction: accepted
        ? 'The customer accepted the resolution and the ticket is now closed.'
        : 'The customer still needs help and the ticket has returned to In Progress.',
      ticket,
    }),
  });
}

module.exports = {
  notifyTicketCreated,
  notifyTicketAssigned,
  notifyStatusChanged,
  notifyCommentAdded,
  notifyResolutionReviewed,
};