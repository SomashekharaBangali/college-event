# Campus Connect

Campus Connect is a campus social app for students to find clubs and events, book event seats, and share campus updates. The React client talks to a local Express API; the server stores shared records in an Excel workbook and sends live updates over Socket.IO.

## Features

- Sign up with a configured college email domain and log in with a password.
- Create clubs, request club membership, and manage membership requests.
- Publish events and book seats for yourself and guests.
- Manage club members and organizers, event participants, campus contacts, and announcements.
- Receive live updates when shared campus data changes.

Passwords are stored as PBKDF2 hashes. Email verification codes and payment collection are not available without external mail and payment services; priced events do not collect payment.

## Requirements

- Node.js 20.19+ or 22.12+
- npm

## Run locally

From the repository root:

```sh
npm ci
npm run dev
```

The client is available at [http://localhost:5173](http://localhost:5173). The API and Socket.IO server run on port `4000`; check the API at [http://localhost:4000/api/health](http://localhost:4000/api/health).

On first server startup, the app creates `server/.env` with a generated `JWT_SECRET` if one is not already configured. The default signup domain is `newhorizonindia.edu`.

## Configuration

Set optional server settings in `server/.env`:

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `4000` | API and Socket.IO port |
| `HOST` | `0.0.0.0` | Address the server listens on |
| `ALLOWED_EMAIL_DOMAINS` | `newhorizonindia.edu` | Comma-separated domains allowed to sign up |
| `JWT_SECRET` | Generated on first startup | Secret used to sign login tokens; set a value of at least 32 characters to manage it yourself |
| `WORKBOOK_PATH` | `../Book2.xlsx` | Workbook location, relative to the `server` directory |

The server initializes the workbook and its sheets when it starts. Keep the workbook on the server that runs the API and make a backup before replacing or editing it. The workbook and `.env` files are excluded from Git; pushing this repository does not upload workbook data or secrets.

For campus-network access, run one server instance with a shared workbook. The development client uses Vite to proxy API and Socket.IO requests to `127.0.0.1:4000`.

## Checks

Run the server tests and build the client from the repository root:

```sh
npm test
npm run build
```

## Project layout

```text
client/                 React, Vite, and Tailwind client
  src/api/              API, campus data, and realtime clients
  src/pages/            Signup and campus dashboard
server/                 Express and Socket.IO server
  controllers/          Authentication and campus data handlers
  routes/               API routes
  tests/                API and workbook tests
  utils/                Configuration, password, realtime, and workbook helpers
Book2.xlsx              Local shared workbook (not tracked by Git)
```
