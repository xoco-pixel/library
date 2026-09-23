# GM3SAB Library

A real full-stack mobile-first library app built with React + Vite + Express + SQLite.

## Quick start

```bash
npm install
npm run dev
```

Open the Vite app at `http://localhost:5173`.

## Environment

Create a `.env` file with:

```env
PORT=4000
SESSION_SECRET=change-this-in-production
OWNER_EMAIL=owner@example.com
```

Then sign up with the same email address to become the first owner.

## Features included

- Book library and public listing
- Search and category filtering
- Account signup/login
- Secure server-side session auth
- Member/owner role separation
- Saved-books feature
- Book reader with chapter navigation and text size controls
- Owner admin panel to create books and publish/unpublish them
- SQLite database for persistence
- Cover URL support and upload-ready server setup

## Notes

This app is designed to be a working full-stack foundation and is intentionally not a static mockup. It persists data to SQLite locally and secures admin actions on the backend.
