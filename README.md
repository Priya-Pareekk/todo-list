# PulseTasks

A full-stack task management app with:

- Frontend: plain HTML, CSS, JavaScript
- Backend: Node.js, Express, MongoDB Atlas, Mongoose
- Auth: JWT access + refresh token flow

## Project Structure

- `index.html` - frontend entry page
- `styles.css` - frontend styles
- `script.js` - frontend logic and API calls
- `config.js` - frontend API base URL config
- `backend/` - Express + MongoDB backend

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

## Environment Variables (backend/.env)

Required:

- `PORT=5000`
- `MONGODB_URI=...`
- `JWT_SECRET=...`
- `JWT_EXPIRES_IN=1d`
- `JWT_REFRESH_SECRET=...`
- `JWT_REFRESH_EXPIRES_IN=7d`

## Authentication Endpoints

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Notes

- UI is plain HTML/CSS/JS (no React).
- Profile and task routes are JWT-protected.
- Data is user-isolated using user identity from token.
