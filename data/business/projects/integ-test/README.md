# React Demo · Vite + TS

This is the FDE Demo template. It is a real React project so the same code base can be promoted to production.

## Run

```bash
npm install
npm run dev
# open http://localhost:5173
```

MSW is enabled in dev and `npm run preview`. It mocks `/api/scenarios` and `/api/chart`.

## Routes

- `/` Dashboard
- `/scenario` Scenarios + mock responses
- `/chart` Pilot KPIs
- `/settings` Mock configuration

## Promote to production

1. Remove MSW handlers in `src/lib/msw/handlers.ts`.
2. Set `VITE_API_BASE` to the real backend.
3. Switch `src/lib/api.ts` (to be added) from MSW client to fetch.

## Design tokens

- Primary `#0F172A`
- Accent `#22D3EE`
- Highlight `#FACC15`
- Surface `#F8FAFC`

See `tailwind.config.js` for the full token list.
