require('dotenv').config();

const app = require('./app');

const PORT = process.env.PORT || 4000;

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

/*
 * Every request-handling rejection already goes through catchAsync into
 * errorHandler.js, so a rejection reaching this point means a bug outside
 * the request lifecycle (an unawaited promise, a timer, a background
 * job). Node leaves the process in an unknown state once that happens --
 * continuing to serve requests on top of it risks silent data corruption
 * rather than a clean, visible failure. Log it loudly and let the process
 * manager (nodemon in dev, systemd/pm2/docker in production) restart a
 * fresh process instead.
 */
function shutDown(label, error) {
  console.error(`${label}! Shutting down.`);
  console.error(error);

  server.close(() => process.exit(1));

  // server.close() waits for in-flight requests to finish, which may
  // never happen if the thing that crashed was itself holding a
  // connection open. Force the exit rather than hang forever.
  setTimeout(() => process.exit(1), 10000).unref();
}

process.on('unhandledRejection', (reason) => shutDown('UNHANDLED REJECTION', reason));
process.on('uncaughtException', (error) => shutDown('UNCAUGHT EXCEPTION', error));
