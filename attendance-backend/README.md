# 4GYM QUSAIS — Attendance Backend

Express + MongoDB API for the attendance system. The tablet/web client lives in
`../attendance-tablet-app` and is deployed separately.

## Environment

Copy `.env.example` to `.env` and fill it in. Never commit the real `.env`.

| Variable | Required | Notes |
|---|---|---|
| `MONGO_URI` or `MONGO_URL` | yes | Either name works. The server exits if neither is set. |
| `JWT_SECRET` | yes | The server refuses to start without it. Generate a fresh one (below). |
| `PORT` | no | Defaults to 5000. On Railway, the platform injects this. |
| `NODE_ENV` | no | |

Generate a secret:

```
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Run locally

```
npm install
npm start        # or: npm run dev
```

Check it came up: `GET /api/health`.

## Create the first admin

Public registration always creates a `staff` account — `role` is deliberately not
read from the request body, so nobody can register themselves as an owner. The
first owner is created out-of-band with this script:

```
MONGO_URI="..." ADMIN_EMAIL="admin@4gym.ae" ADMIN_PASSWORD="..." node create-admin.js
```

Credentials come from the environment; nothing is hardcoded. Safe to re-run — an
existing account has its password reset and role restored.

After that, an owner can promote others via `PUT /api/staff/:staff_id/role`.

## Roles

`staff` | `manager` | `owner`. The client unlocks the admin panel for `manager`
and `owner`. There is no `admin` role — it is not in the schema enum and grants
nothing.

## Auth notes

Login is by **email**, not username. Emails are normalized to lowercase on both
registration and login, so capitalization does not matter.

## Deploying on Railway

Set the service's **Root Directory** to `attendance-backend`, otherwise the build
scans the repo root, finds no `package.json`, and fails with "Failed to build an
image".
