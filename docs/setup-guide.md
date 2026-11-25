# Setup guide

How to get the helpdesk running on a Windows laptop from scratch, and
how to fix the problems we actually hit. Written for teammates and
markers setting the project up for the first time. Allow about 30
minutes, most of it downloads.

Tested on Windows 11 with Node.js 22, npm 10, Git 2.49, XAMPP (MariaDB)
and Ollama 0.32.

## 1. Install the tools

| Tool | Why | Get it |
| --- | --- | --- |
| Node.js 20 or newer (includes npm) | Runs the backend and the frontend | nodejs.org (LTS) |
| Git | Gets the code | git-scm.com |
| XAMPP | The MySQL/MariaDB database | apachefriends.org |
| Ollama | Runs the AI models on your own laptop, no API key needed | ollama.com/download |

Check them in a new terminal:

```bash
node --version
npm --version
git --version
ollama --version
```

## 2. Put the project outside OneDrive

**Do not clone the project into a OneDrive folder** (for example
`Desktop` or `Documents` when OneDrive is backing them up). OneDrive
tries to sync the tens of thousands of small files in `node_modules`
while npm and Git are writing them. That causes:

- `npm install` failing with `EPERM` / `EBUSY` ("operation not
  permitted", "resource busy or locked");
- Git errors about `index.lock` or files it can't update;
- everything being slow, and OneDrive filling up with files that
  shouldn't be backed up at all (GitHub is the backup).

Use a plain folder instead, for example:

```bash
mkdir "C:\studio 5"
cd "C:\studio 5"
git clone https://github.com/kawal285/helpdesk-ticketing-system.git
cd helpdesk-ticketing-system
```

To check where you are, run `pwd` (Git Bash) or `cd` (Command Prompt).
If the path contains `OneDrive`, move it.

### Moving an existing copy out of OneDrive

1. In the old folder, commit and push anything you want to keep:
   `git status`, then `git add`, `git commit`, `git push`.
2. Copy your `.env` file somewhere safe. It is not in Git.
3. Clone a fresh copy into the new folder (commands above) and put
   `.env` back in its main folder.
4. Run `npm install` in the main folder and in `Frontend`.
5. When the new copy runs (step 9), delete the old folder from OneDrive.

A fresh clone is safer than dragging the old folder, because it doesn't
carry over a half-synced `node_modules` or `.git` folder.

## 3. Start the database

1. Open the **XAMPP Control Panel** and click **Start** next to **MySQL**.
2. Click **Admin** (or open http://localhost/phpmyadmin) and create two
   empty databases:
   - `helpdesk_dev`: the app's data
   - `helpdesk_dev_test`: used by the automated tests, which wipe it
     every run

If you change `DB_NAME` in `.env`, the test database is always
`DB_NAME` plus `_test`.

**If you also have "MySQL Server 8" installed** (a Windows service
called `MySQL80`), it starts with Windows and takes port 3306 before
XAMPP can. You'll see `Access denied for user 'root'@'localhost'`. Fix it
once, in PowerShell **run as administrator**:

```powershell
Stop-Service MySQL80
Set-Service MySQL80 -StartupType Manual
```

Then start MySQL in XAMPP again.

## 4. Get the AI models (Ollama)

Start Ollama (open the Ollama app, or run `ollama list`), then download
the two models the app uses:

```bash
ollama pull llama3.2           # answers questions and classifies tickets (about 2 GB)
ollama pull nomic-embed-text   # turns text into vectors for searching (about 270 MB)
```

### Updating Ollama

When an update is ready, the Ollama icon in the system tray shows
**Restart to update**. Click it (or install the latest version from
ollama.com/download over the top). Your downloaded models are kept.

**After installing or updating, check everything still works:**

```bash
npm run check:ai
```

It checks that Ollama is running, both models are there, embeddings
have 768 numbers, the model answers, and it returns token probabilities
(used by the "Needs human check" feature). Every line should say PASS.

## 5. Configure `.env`

In the main project folder:

```bash
cp .env.example .env
```

Then edit `.env`:

- `DB_USER` / `DB_PASSWORD`: XAMPP's default is `root` with an empty
  password.
- `JWT_SECRET`: any long random string.
- `ADMIN_EMAIL` / `ADMIN_PASSWORD`: the first admin account, created by
  the seeder in the next step. Use your own values.
- Email settings can stay empty: notifications are then skipped.

**Never commit `.env`.** It holds passwords and secrets.

## 6. Install and set up the backend

From the main project folder:

```bash
npm install
npm run migrate        # creates the tables
npm run seed           # the admin account and the default P1-P4 target times
npm run kb:index       # loads the knowledge base and embeds it for the AI search
npm run tickets:index  # embeds existing tickets for "Similar open tickets" (safe on an empty database)
```

`kb:index` needs Ollama running. Re-run it if you change the knowledge
base or the embedding model (`npm run kb:index -- --force` re-embeds
everything).

## 7. Install the frontend

```bash
cd Frontend
npm install
cd ..
```

## 8. Run the app

Two terminals, both left open:

```bash
# Terminal 1 (main folder): the API on http://localhost:4000
npm run dev

# Terminal 2: the website on http://localhost:5173
cd Frontend
npm run dev
```

Keep XAMPP's MySQL and Ollama running too.

## 9. Check it works

1. http://localhost:4000/health should answer.
2. Open http://localhost:5173 and log in with the `ADMIN_EMAIL` and
   `ADMIN_PASSWORD` from `.env`.
3. Ask the AI Assistant "How do I reset my password?". It should answer
   from the knowledge base. **The first answer can take 20-30 seconds**
   while Ollama loads the model; after that it's a few seconds.
4. Register a customer account and create a ticket. The AI should fill
   in a category and a P1-P4 priority.

## 10. Run the tests

From the main folder, with XAMPP's MySQL running:

```bash
npm test
```

All tests should pass. They use `helpdesk_dev_test` and never touch
your real data. The AI and web search are replaced with stand-ins, so
Ollama doesn't need to be running.

Frontend checks:

```bash
cd Frontend
npm run lint
npm run build
```

The build's "chunks are larger than 500 kB" message is only a
warning.

## Evaluation scripts (optional, for the report)

These call the real models, so Ollama must be running. Each one writes
its results to a file in `docs/`.

| Command | Measures |
| --- | --- |
| `node scripts/ai/evaluate-classification.js` | Ticket category/priority accuracy, F1, kappa, and the "Needs human check" handoff (40 tickets) |
| `node scripts/rag/evaluate-retrieval-ranking.js` | KB search Hit@1, Hit@3, MRR (29 questions) |
| `node scripts/ai/evaluate-similar-tickets.js` | Duplicate ticket detection threshold |
| `node scripts/ai/evaluate-gap-grouping.js` | Knowledge-gap topic grouping |

## Troubleshooting

| Problem | Cause and fix |
| --- | --- |
| `Access denied for user 'root'@'localhost'` | The `MySQL80` Windows service is using port 3306. See step 3. |
| `Unknown database 'helpdesk_dev'` or `'helpdesk_dev_test'` | Create it in phpMyAdmin (step 3). |
| `npm install` fails with `EPERM` / `EBUSY` | The project is inside OneDrive. Move it (step 2). |
| `Could not reach Ollama at http://127.0.0.1:11434` | Start Ollama, then `npm run check:ai`. |
| `model "llama3.2" not found` | `ollama pull llama3.2` (and `nomic-embed-text`). |
| The assistant says it can't find anything for every question | The KB isn't indexed yet: `npm run kb:index`. |
| The first AI answer times out | The model is still loading. Ask again, or raise `AI_TIMEOUT_MS` / `GENERATION_TIMEOUT_MS` in `.env`. |
| `EADDRINUSE` on port 4000 or 5173 | The app is already running in another terminal. Close it first. |
| Web search results never appear | DuckDuckGo can be slow (we measured under 1s to over 10s). The assistant still answers from the KB. Set `WEB_SEARCH_PROVIDER=none` to turn it off. |
