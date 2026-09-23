# GM3SAB Library

Mobile-first React/Vite foundation for the GM3SAB digital library experience.

## Run locally

```bash
npm install
npm run dev
```

This first implementation establishes the responsive library, reader, saved-books interaction, progress persistence, profile, and owner dashboard UI. Data currently ships as clearly separated seed content and user reading/saved state is persisted locally while the server/API layer is being added.

The production owner system must use server-side authentication, PostgreSQL persistence, secure sessions, and `OWNER_EMAIL`/`SESSION_SECRET` environment variables; no credentials are stored in this repository.
