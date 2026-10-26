
AI-Enabled Helpdesk Ticketing System

An AI-enabled support portal developed as a Studio 5 project for Auckland International Campus, Otago Polytechnic and FutureSkills.

The system allows customers to ask for troubleshooting guidance, create support tickets and track their progress. Support agents and administrators can manage tickets, assignments, comments, priorities, notifications and reports.

Project status

This project is currently under active development. The main ticketing features, role-based dashboards, reporting, knowledge base and local Ollama integration are being tested and improved before the final client demonstration and PDR.

Main features
Customer
Register and log in securely
View a personalised support dashboard
Ask the AI Assistant for troubleshooting guidance
Create and track support tickets
View ticket status, priority and category
Add comments and communicate with support staff
Review resolved tickets
Support agent
View the support queue
Open and manage assigned tickets
Update ticket status, category and priority
Add internal or customer-facing comments
Resolve support requests
Administrator
View and manage all tickets
Assign tickets to support agents
Manage user accounts
Filter tickets by agent, organisation and overdue status
View dashboard summaries and reports
View pie/doughnut charts and bar graphs
Manage system settings
AI and knowledge base
Local AI generation using Ollama
Embeddings using nomic-embed-text
Answer generation using llama3.2
Retrieval-Augmented Generation (RAG)
Answers based on approved helpdesk documentation
Source citations included with AI responses
Option to create a ticket when AI guidance does not solve the issue
Notifications
Ticket-created notifications
Assignment notifications
Comment notifications
Status-update notifications
Email-service automated tests
Technology stack
Area	Technology
Frontend	React, Vite and JavaScript
Backend	Node.js and Express
Database	MySQL and Sequelize
Authentication	JSON Web Token (JWT)
Local AI	Ollama
Embedding model	nomic-embed-text
Generation model	llama3.2
Testing	Jest and Postman
Version control	Git and GitHub
Project structure
helpdesk-ticketing-system/
├── Frontend/              # React customer and staff portal
├── config/                # Sequelize configuration
├── migrations/            # Database migrations
├── seeders/               # Initial database records
├── src/
│   ├── controllers/       # Request-handling logic
│   ├── data/              # Knowledge-base information
│   ├── middleware/        # Authentication and error handling
│   ├── models/            # Sequelize models
│   ├── routes/            # Backend API routes
│   ├── services/          # AI, RAG, email and application services
│   └── server.js          # Backend entry point
└── tests/                 # Automated backend tests
Requirements

Install the following software before running the project:

Node.js and npm
MySQL, such as the MySQL service included with XAMPP
Git
Ollama for local AI features
Download the project
git clone https://github.com/kawal285/helpdesk-ticketing-system.git
cd helpdesk-ticketing-system
Backend setup

Install the backend packages:

npm install

Create a .env file in the main project folder. Use the environment-variable names expected by config/config.js and the existing service files.

Never commit .env, database passwords, JWT secrets or external API keys to GitHub.

Example AI configuration:

EMBEDDING_PROVIDER=ollama
EMBEDDING_MODEL=nomic-embed-text
EMBEDDING_DIMENSIONS=768

RAG_SIMILARITY_THRESHOLD=0.59
RAG_TOP_K=4
RAG_MAX_PER_ARTICLE=2
RAG_RELATIVE_CUTOFF=0.06

GENERATION_PROVIDER=ollama
GENERATION_MODEL=llama3.2

Start MySQL and ensure the development database named in the environment configuration exists.

Run the database migrations:

npx sequelize-cli db:migrate

Start the backend:

npm run dev

The backend normally runs at:

http://localhost:4000

Check its health at:

http://localhost:4000/health
Ollama setup

Install Ollama from ollama.com/download, then close and reopen the terminal.

Download the embedding model:

ollama pull nomic-embed-text

Download the generation model:

ollama pull llama3.2

Confirm both models are available:

ollama list

Ollama normally provides its local service at:

http://localhost:11434

Restart the backend after changing the AI environment configuration.

Frontend setup

Open another terminal:

cd Frontend
npm install
npm run dev

The frontend normally runs at:

http://localhost:5173

Keep the backend, frontend, MySQL and Ollama services running during the demonstration.

Build the frontend
cd Frontend
npm run build

The Vite chunk-size message is a performance warning and does not mean that the build failed.

Run automated tests

From the main project folder:

npm test -- --runInBand

The test suite covers areas such as authentication, role-based access, ticket routing, comments, the AI service, health checks and the email service.

User roles
Role	Access
Customer	AI guidance, dashboard, tickets, comments and account
Agent	Support queue, assigned tickets, comments and status updates
Administrator	All tickets, assignments, users, reports and settings

Passwords are stored securely as hashes and must not be written in this README.

Ticket workflow
Open → In Progress → Resolved / Awaiting Review → Reviewed and Closed
Branding

The portal uses the client-provided AIC, Otago Polytechnic and FutureSkills branding. Colours, logos and interface changes are reviewed with the client during project demonstrations.


