# Backend Server 🚀

A simple Node.js + Express backend using Supabase (Postgres) as the primary datastore.

## Installation
```bash
npm install
```

## Run Development Server
```bash
npm run dev
```

## Environment
Create a `.env` file with the following required variables for server-side operation:
```
PORT=5500
CLIENT_URL=http://localhost:3000
JWT_SECRET=your_jwt_secret

# Supabase (server only - keep secret)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Cloudinary (optional, used for image uploads)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

## Tech Stack
Node.js | Express | Supabase (Postgres) | Dotenv | Nodemon

