# Job Application Tracker

A web app for tracking your job search: save applications, view them as a list or a Kanban board, and see what needs attention next (follow-ups, upcoming interviews).

**Live demo:** <https://nhokconpero123.github.io/job-tracker-demo/>

The live demo runs entirely in your browser with sample data, so no server is needed. The full version (React frontend + Express/SQLite backend) is included in this repository and can be run locally.

<!--
Add screenshots to a docs/screenshots/ folder and uncomment the lines below:

![List view](docs/screenshots/list.png)
![Kanban view](docs/screenshots/kanban.png)
-->

## Features

- Track applications with company, position, job posting URL, salary, applied date, interview date, follow-up date and notes.
- Five statuses: `wishlist`, `applied`, `interview`, `offer`, `rejected`.
- Two views: **List** and **Kanban board**, where dragging a card to another column changes its status.
- Search by company or position, and filter by status.
- Reminder badges: "Follow-up due" when the date arrives, and "Upcoming interview" within the next 7 days.
- Statistics showing the number of applications per status.
- Clear error handling: messages for connection failures and invalid data, and stale responses are ignored when you type quickly in the search box.

## Demo mode vs. full mode

| | Demo mode | Full mode |
|---|---|---|
| Backend needed | No | Yes (Express + SQLite) |
| Where data lives | Your browser (`localStorage`) | SQLite database file on your machine |
| Starting data | Sample applications | Empty |
| Used for | The live demo on GitHub Pages | Local development |

In demo mode your data never leaves your browser. Clearing your browser data resets it to the sample applications.

## Tech stack

| Area | Technology |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | SQLite (`better-sqlite3`) |
| Testing | Vitest |
| Hosting (demo) | GitHub Pages, deployed with GitHub Actions |

## Project structure

```
job-tracker-demo/
├── backend/          # Express API, SQLite, tests
│   ├── src/
│   └── tests/
├── frontend/         # React + Vite app
│   ├── src/
│   └── .env.demo     # Turns on demo mode for `--mode demo`
└── README.md
```

## Prerequisites

- [Node.js](https://nodejs.org) LTS (includes `npm`)
- [Git](https://git-scm.com)

## Getting started (full mode)

The backend and frontend run in two separate terminal windows.

**1. Get the code**

```bash
git clone https://github.com/nhokconpero123/job-tracker-demo.git
cd job-tracker-demo
```

**2. Run the backend** (port 4000)

```bash
cd backend
npm install
npm run dev
```

On success the terminal prints `Backend listening on port 4000`. The `applications.db` file is created automatically on first run.

**3. Run the frontend** (port 5173), in another terminal

```bash
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>.

### Environment variables

The frontend reads the API address from `VITE_API_URL`. If it is not set, the default is `http://localhost:4000/api`. See `frontend/.env.example`.

> **Note:** the backend only allows (CORS) a page served from exactly `http://localhost:5173`. If another program is already using port 5173, Vite switches to a different port and the page will report that it cannot reach the API. Stop the program using the port and start the frontend again.

## Running the demo locally

No backend is needed. From the `frontend` folder:

```bash
npm install
npm run build -- --mode demo
npm run preview -- --mode demo
```

Then open the address printed in the terminal. It ends with `/job-tracker-demo/`, because that is the path the site uses on GitHub Pages.

## Testing

```bash
cd backend
npm test
```

Tests run against their own database and never touch your real data.

## API

Base URL: `http://localhost:4000/api`

| Method | Path | Description |
|---|---|---|
| `GET` | `/applications?status=&q=` | List applications, optionally filtered by status and keyword |
| `POST` | `/applications` | Create an application |
| `GET` | `/applications/:id` | Get one application |
| `PATCH` | `/applications/:id` | Partially update an application |
| `DELETE` | `/applications/:id` | Delete an application (returns `204`) |
| `GET` | `/stats` | Total count and count per status |

Errors are returned as `{ "error": "message" }` with the matching HTTP status (`400` for invalid input, `404` when an application does not exist).

## Roadmap

- Edit every field of an application from the UI
- Statistics charts and response-rate metrics
- Export data to CSV
- Attach a CV and interview notes
- Deploy the backend so the full version can be used online

## License

No license has been chosen yet. To let others reuse the code, add a `LICENSE` file (for example MIT).