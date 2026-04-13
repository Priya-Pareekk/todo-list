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

## 3) Install and run locally

1. Open terminal in backend folder
2. Install dependencies:
   npm install
3. Start dev server:
   npm run dev

Server URL (default):
http://localhost:5000

## 4) API endpoints

### User context bootstrap
- POST /api/users/bootstrap

Body:
{
  "email": "demo@example.com",
  "displayName": "Demo User"
}

### Profiles (requires x-user-id header)
- POST /api/profiles
- GET /api/profiles
- GET /api/profiles/:id
- PUT /api/profiles/:id
- DELETE /api/profiles/:id

### Tasks (requires x-user-id header)
- POST /api/tasks
- GET /api/tasks
- GET /api/tasks/profile/:profileId
- PUT /api/tasks/:id
- DELETE /api/tasks/:id
- PATCH /api/tasks/:id/status

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
- Current user context is passed via x-user-id header.
- This is intentionally structured so JWT middleware can replace the current context middleware later with minimal refactor.
- OAuth and Razorpay can be added by extending User fields and adding dedicated routes/services.
