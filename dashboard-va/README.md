# Dashboard VA

Rebuild of `mockup.html` as a standalone Next.js + Tailwind project.

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Notes

- Dashboard data is embedded in `lib/dashboard-data.ts`.
- Notes and initiative comments are stored in browser `localStorage`.
- Charts are rendered with SVG, so no chart library dependency is required.
