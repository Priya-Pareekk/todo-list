# PulseTasks

A full-stack task management app with:

- Frontend: plain HTML, CSS, JavaScript
- Backend: Node.js, Express, MongoDB Atlas, Mongoose
- Auth: local login/signup + Google OAuth + JWT access/refresh flow
- Billing: Razorpay premium upgrade

## Project Structure

- `index.html` - frontend entry page
- `styles.css` - frontend styles
- `script.js` - frontend logic and API calls
- `config.js` - frontend API base URL config
- `backend/` - Express + MongoDB backend

## Current Plan Rules

- Free plan:
	- max 2 profiles
	- max 3 tasks
- Premium plan:
	- unlimited profiles
	- unlimited tasks

When free task limit is exceeded, backend returns:

- `Premium required to add more tasks`

## Run Locally

### 1) Backend

```bash
npm --prefix "backend" install
npm --prefix "backend" run start
```

Backend runs on `http://localhost:5000` by default.

### 2) Frontend

Open `index.html` with Live Server (or any static server).

Example with VS Code Live Server:
- Right-click `index.html`
- Click **Open with Live Server**

## Deploy On Vercel

This repo is configured for a single Vercel project:

- static frontend from project root (`index.html`, `script.js`, `styles.css`)
- backend API as serverless function at `/api` (via `api/index.js`)

### 1) Push this repository to GitHub

Vercel should deploy from the root folder (the one containing `vercel.json`).

### 2) Import project in Vercel

- Framework preset: **Other**
- Root directory: **.** (repo root)
- Build command: leave empty
- Output directory: leave empty

### 3) Add environment variables in Vercel

Add all backend variables from `.env` in Vercel Project Settings -> Environment Variables:

- `MONGODB_URI`
- `JWT_SECRET`
- `JWT_EXPIRES_IN` (example: `1d`)
- `JWT_REFRESH_SECRET`
- `JWT_REFRESH_EXPIRES_IN` (example: `7d`)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `FRONTEND_URL`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

Use production URLs:

- `GOOGLE_CALLBACK_URL=https://<your-vercel-domain>/api/auth/google/callback`
- `FRONTEND_URL=https://<your-vercel-domain>/`

### 4) Update Google OAuth console

In Google Cloud Console, add the same deployed callback URL to **Authorized redirect URIs**:

- `https://<your-vercel-domain>/api/auth/google/callback`

### 5) Redeploy

After setting env vars, trigger a redeploy from Vercel.

Notes:

- Frontend API base URL auto-switches to same-origin `/api` in deployment.
- Local `file://` use still targets `http://localhost:5000/api` by default.

## Environment Variables (backend/.env)

Required:

- `PORT=5000`
- `MONGODB_URI=...`
- `JWT_SECRET=...`
- `JWT_EXPIRES_IN=1d`
- `JWT_REFRESH_SECRET=...`
- `JWT_REFRESH_EXPIRES_IN=7d`
- `GOOGLE_CLIENT_ID=...`
- `GOOGLE_CLIENT_SECRET=...`
- `GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback`
- `FRONTEND_URL=http://localhost:3000/index.html`
- `RAZORPAY_KEY_ID=...`
- `RAZORPAY_KEY_SECRET=...`

## Authentication Endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/google`
- `GET /api/auth/google/callback`

## Billing Endpoints (JWT protected)

- `GET /api/billing/config`
- `GET /api/billing/subscription`
- `POST /api/billing/create-order`
- `POST /api/billing/verify`

## Razorpay Plan Details

- Premium price: `INR 9` (`900` paise)
- Checkout methods enabled in frontend:
	- UPI
	- QR (via UPI flow)
	- Cards
	- Netbanking

## Frontend Premium UX (No Redesign)

- Profile page shows:
	- `Current Plan: Free` or `Current Plan: Premium`
	- `Task Usage: current/3` for free users
	- `Task Usage: Unlimited` for premium users
- If user hits free task limit, a minimal modal opens with:
	- message: `Premium required to add more tasks`
	- button: `Upgrade Now`
	- button: `Cancel`

## Notes

- UI is plain HTML/CSS/JS (no React).
- Profile and task routes are JWT-protected.
- Data is user-isolated using user identity from token.
- Existing styling remains unchanged; only minimal UI elements were added for premium flow.
