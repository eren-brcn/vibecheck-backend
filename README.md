# VibeCheck Backend

Express + MongoDB API for authentication, groups, messaging, uploads, and concert discovery.

## Live URLs
- Frontend App: https://vibecheck-sigma-virid.vercel.app
- Backend API: https://vibecheck-server.vercel.app

## Stack
- Node.js + Express
- MongoDB + Mongoose
- JWT auth
- Socket.IO (real-time chat)
- Cloudinary (image uploads)
- Ticketmaster API (concert search)

## Scripts
- `npm run dev` — run server with watch mode
- `npm start` — run server

## Local Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` from `.env.example` and set values.
3. Start the API:
   ```bash
   npm run dev
   ```
4. API base URL locally:
   - `http://localhost:5005/api`

## Environment Variables
Required keys:
- `PORT` (example: `5005`)
- `MONGODB_URI`
- `JWT_SECRET` (or `TOKEN_SECRET` as fallback)
- `ORIGIN` (frontend URL for CORS)
- `TICKETMASTER_KEY`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

## API Routes
Base prefix: `/api`

### Health
- `GET /` → basic health response

### Auth
- `POST /auth/signup`
- `POST /auth/login`
- `GET /auth/me` (protected)
- `PUT /auth/me/photo` (protected)

### Groups
- `GET /groups`
- `GET /groups/my-groups` (protected)
- `GET /groups/:id`
- `POST /groups` (protected)
- `PUT /groups/join/:id` (protected)
- `PUT /groups/leave/:id` (protected)
- `PUT /groups/kick/:groupId/:userId` (protected, organiser only)
- `DELETE /groups/mine/all` (protected, organiser only)
- `DELETE /groups/:id` (protected, organiser only)

### Messages
- `GET /messages/:roomId` (protected)

### Concerts
- `GET /concerts/search?country=TR&city=Ankara`

### Uploads
- `POST /upload` (multipart/form-data, field: `image`)

## Real-Time (Socket.IO)
Socket events:
- `join_room` with room id
- `send_message` with message payload
- Server emits `receive_message`

## Deployment Notes (Vercel)
- Set backend env var:
  - `ORIGIN=https://your-frontend-domain.vercel.app`
- Ensure frontend env var points to backend:
  - `VITE_SERVER_URL=https://your-backend-domain.vercel.app`
- Redeploy after env changes.

## Frontend Integration
- REST calls should target: `${VITE_SERVER_URL}/api/...`
- Send JWT in `Authorization: Bearer <token>` for protected routes.
