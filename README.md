# GM3SAB Library

This repository contains a mobile-first React/Vite client and a server-side Express application.

## Run

```bash
cp .env.example .env
# Set a private OWNER_EMAIL and a long random SESSION_SECRET
npm install
npm run dev
```

The client runs on port 5173 and proxies `/api` and `/uploads` to the API on port 4000.

## First owner

Set `OWNER_EMAIL` in the server environment before the first owner signs up. The first account using that exact address becomes OWNER; all other accounts are MEMBER. Email matching alone does not grant access after an owner exists. Never put the password in source control or in a public/client environment variable.

## Security and persistence

- HttpOnly, SameSite session cookies; Secure cookies in production
- bcrypt password hashes; no password hashes are serialized
- Server-side OWNER authorization on admin routes
- Rate limiting for authentication and API writes
- Helmet security headers
- Published-only public book queries
- Ownership checks for saved books, progress, bookmarks, reviews, and comments
- SQLite persistence for local/Replit development, with foreign keys, indexes, and audit logs
- Draft publication validation requires metadata and chapters
- Cover uploads restricted to JPEG/PNG/WebP and 2 MB

The application is not declared production-ready until it has been run with production secrets, a managed database/session store, and deployment smoke/security tests. No credentials are committed here.
