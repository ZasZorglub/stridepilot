# StridePilot

AI-baseret loebeapp med:
- onboarding-flow: Velkomst -> Konto -> Profil/Maal -> Program/Kalender -> Intervalpas
- konto/login
- AI-generering af loebeplan
- interval-timer med ping-lyd ved step-skift
- feedback-skabelon efter hvert pas
- automatisk plan-tilpasning baseret pa feedback
- kalenderexport via `.ics`
- Postgres-lagring via Prisma
- Web Push reminders (test + automatisk scheduler)

## 1. Installation

```bash
npm install
cp .env.example .env
```

## 2. Miljoevariabler

Udfyld i `.env`:
- `DATABASE_URL`
- `AUTH_SECRET`
- `OPENAI_API_KEY` (valgfri)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `CRON_SECRET`
- `PUSH_WINDOW_MINUTES` (valgfri)

Generer VAPID keys:

```bash
npx web-push generate-vapid-keys
```

## 3. Database (Prisma)

```bash
npx prisma migrate dev -n init
npx prisma generate
```

## 4. Kør app

```bash
npm run dev
```

Aabn [http://localhost:3000](http://localhost:3000).

## API

Auth:
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Plan/feedback:
- `POST /api/generate-plan`
- `POST /api/workout-feedback`
- `POST /api/calendar/ics`

Push:
- `GET /api/push/vapid-public-key`
- `POST /api/push/subscribe`
- `POST /api/push/send-test`
- `GET|POST /api/push/send-due`

## Automatisk reminders (Vercel)

`vercel.json` indeholder hourly cron:
- `0 * * * *` -> `/api/push/send-due`

Hvis `CRON_SECRET` er sat, skal request have header `x-cron-secret`.

## Bemærkninger

- Push kraever HTTPS i produktion.
- Hvis DB ikke er tilgaengelig, virker appen delvist, men uden persistence og adaptiv feedback over tid.
