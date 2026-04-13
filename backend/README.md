# PulseTasks Backend

Node.js + Express + MongoDB Atlas backend for the existing PulseTasks frontend.

## 1) Folder structure

src/
- config/ - database setup
- controllers/ - request handlers
- middlewares/ - validation, user context, error handlers
- models/ - Mongoose schemas
- routes/ - API route definitions
- utils/ - shared helpers
- validators/ - request validation rules

## 2) Environment variables

Create a .env file in backend folder using .env.example:

PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_long_random_secret
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=your_long_random_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
FRONTEND_URL=http://localhost:3000/index.html
RAZORPAY_KEY_ID=your_razorpay_test_key_id
RAZORPAY_KEY_SECRET=your_razorpay_test_key_secret

## 3) Install and run locally

1. Open terminal in backend folder
2. Install dependencies:
   npm install
3. Start dev server:
   npm run dev

Server URL (default):
http://localhost:5000

## 4) API endpoints

### Auth
- POST /api/auth/signup
- POST /api/auth/login
- POST /api/auth/refresh
- POST /api/auth/logout
- GET /api/auth/me (requires Bearer token)
- GET /api/auth/google
- GET /api/auth/google/callback

Signup body:
{
  "name": "Demo User",
  "email": "demo@example.com",
  "password": "DemoPass123!"
}

Login body:
{
  "email": "demo@example.com",
  "password": "DemoPass123!"
}

Authorization header for protected endpoints:
Authorization: Bearer <jwt_token>

Refresh body:
{
  "refreshToken": "<refresh_token>"
}

### Profiles (requires Bearer token)
- POST /api/profiles
- GET /api/profiles
- GET /api/profiles/:id
- PUT /api/profiles/:id
- DELETE /api/profiles/:id

### Tasks (requires Bearer token)
- POST /api/tasks
- GET /api/tasks
- GET /api/tasks/profile/:profileId
- PUT /api/tasks/:id
- DELETE /api/tasks/:id
- PATCH /api/tasks/:id/status

### Billing (requires Bearer token)
- GET /api/billing/config
- GET /api/billing/subscription
- POST /api/billing/create-order
- POST /api/billing/verify

Create order body:
{
  "plan": "premium"
}

Verify body:
{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature_xxx",
  "plan": "premium"
}

## 5) Standard response format

Success:
{
  "success": true,
  "message": "Task created",
  "data": {
    "_id": "6618...",
    "title": "Finish assignment"
  }
}

Error:
{
  "success": false,
  "message": "Request validation failed",
  "errors": [
    {
      "type": "field",
      "msg": "Task title is required",
      "path": "title",
      "location": "body"
    }
  ]
}

## 6) Multi-user and future auth readiness

- Data is isolated by user id in every profile/task query.
- Relation model:
  - one user -> many profiles
  - one profile -> many tasks
- User identity is resolved from JWT token for all protected routes.
- Profiles and tasks are always queried with req.user from token to keep user data isolated.
- OAuth and Razorpay can be added by extending User fields and adding dedicated routes/services.

## 7) Plan limits

- Free plan:
  - max 2 profiles
  - max 3 tasks
- Premium plan:
  - unlimited profiles
  - unlimited tasks

When free task limit is reached, backend returns:
- status: 403
- message: `Premium required to add more tasks`

## 8) Local auth test steps

1. Start backend:
  npm run start
2. Signup using /api/auth/signup
3. Login using /api/auth/login and copy token
4. Call /api/auth/me with Authorization header
5. Call /api/profiles and /api/tasks using same Bearer token
6. Call /api/auth/refresh with refreshToken to rotate tokens
7. Call /api/auth/logout to revoke current refresh session

## 9) Frontend JWT behavior

- Access token and refresh token are stored after login.
- Session persists across refresh via localStorage.
- On 401 from protected calls, frontend auto-calls /api/auth/refresh once.
- If refresh fails, frontend clears session and redirects to login.

## 10) Google OAuth setup (step-by-step)

1. Open Google Cloud Console and create/select a project.
2. Go to APIs & Services -> OAuth consent screen.
3. Configure consent screen (app name, support email, developer email).
4. Add scopes: `openid`, `email`, `profile`.
5. Go to APIs & Services -> Credentials -> Create Credentials -> OAuth client ID.
6. Select Application type: Web application.
7. Add Authorized redirect URI:
  `http://localhost:5000/api/auth/google/callback`
8. Copy generated Client ID and Client Secret.
9. Update `backend/.env`:
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback`
  - `FRONTEND_URL=http://localhost:3000/index.html`
10. Restart backend server.
11. In frontend login page, click `Continue with Google`.

Notes:
- First Google login creates a user in MongoDB if email does not exist.
- Existing users are logged in and receive the same JWT access/refresh flow.
- Task/profile ownership remains tied to authenticated user from JWT.

## 11) Razorpay test mode setup and testing

1. Create a Razorpay account and switch to Test Mode.
2. Copy Test Key ID and Test Key Secret.
3. Update backend `.env`:
  - `RAZORPAY_KEY_ID`
  - `RAZORPAY_KEY_SECRET`
4. Restart backend server.
5. Login in frontend.
6. Open Profile screen and click `Upgrade to Premium`.
7. Complete test payment using Razorpay test methods (UPI/QR, card, or netbanking).
8. After success, backend verifies signature, marks payment captured, and upgrades subscription.
9. Confirm with API:
  - `GET /api/auth/me` -> `subscriptionPlan: premium`, `isPremium: true`
  - `GET /api/billing/subscription` -> `plan: premium`, `isPremiumAccess: true`

Premium pricing:
- `premium` = `900` paise (`INR 9`)

Checkout methods configured in frontend:
- UPI
- QR (UPI-based)
- Cards
- Netbanking

Failure handling:
- If checkout is closed, frontend shows `Payment cancelled`.
- If signature is invalid, backend marks payment as failed and returns verification error.
- If free user exceeds task limit, frontend opens premium-required modal with `Upgrade Now` and `Cancel`.
