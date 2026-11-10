const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');

const healthRoute = require('./routes/health.route');
const authRoute = require('./routes/auth.route');
const userRoute = require('./routes/user.route');
const ticketRoute = require('./routes/ticket.route');
const commentRoute = require('./routes/comment.route');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const knowledgeBaseRoute = require('./routes/knowledgeBase.route');
const aiAssistantRoute = require('./routes/aiAssistant.route');
const settingsRoute = require('./routes/settings.route');
const slaTargetRoute = require('./routes/slaTarget.route');
const app = express();

app.use(helmet());
app.use(cors());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));
}
app.use(express.json());

app.use('/health', healthRoute);
app.use('/auth', authRoute);
app.use('/users', userRoute);
app.use('/tickets', ticketRoute);
app.use('/tickets/:ticketId/comments', commentRoute);
app.use('/knowledge-base', knowledgeBaseRoute);
app.use('/ai', aiAssistantRoute);
app.use('/settings', settingsRoute);
app.use('/sla-targets', slaTargetRoute);
app.use(notFound);
app.use(errorHandler);

module.exports = app;
