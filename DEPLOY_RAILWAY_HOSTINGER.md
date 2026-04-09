# Deploy AIMS on Railway + Hostinger Shared

This guide deploys:
- Backend API + PostgreSQL on Railway (free tier)
- Frontend static build on Hostinger Shared

## 1) Push code to GitHub

From project root:

```powershell
git init
git add .
git commit -m "AIMS deploy prep"
git branch -M main
git remote add origin https://github.com/<your-user>/<your-repo>.git
git push -u origin main
```

## 2) Railway: Create PostgreSQL

1. Open Railway dashboard.
2. New Project -> Provision PostgreSQL.
3. Open the PostgreSQL service -> Variables / Connect tab.
4. Copy the public connection URL.

You will use this as `DATABASE_URL` for backend.

## 3) Railway: Deploy backend service

1. In same Railway project: New -> GitHub Repo -> select this repo.
2. Set **Root Directory** to `backend`.
3. Set **Build Command**:

```bash
npm install && npx prisma generate && npx prisma migrate deploy
```

4. Set **Start Command**:

```bash
npm start
```

5. Add Environment Variables:
- `NODE_ENV=production`
- `PORT=5000`
- `DATABASE_URL=<railway-postgres-url>`
- `JWT_SECRET=<long-random-secret>`
- `JWT_EXPIRES_IN=7d`
- `FRONTEND_URL=https://<your-hostinger-domain>,https://www.<your-hostinger-domain>`

6. Deploy and copy backend URL, e.g.
- `https://aims-api-production.up.railway.app`

7. Verify health endpoint:
- `https://<railway-backend-domain>/api/health`

## 4) Seed data once (Railway)

In Railway backend service shell, run:

```bash
npm run db:seed
```

Demo login:
- `admin@aims.local`
- `Admin@123`

## 5) Build frontend for production

Create production env file at `frontend/.env.production`:

```env
VITE_API_URL=https://<railway-backend-domain>/api
```

Then build:

```powershell
cd frontend
npm install
npm run build
```

## 6) Hostinger Shared: Upload frontend

1. Open Hostinger hPanel -> File Manager.
2. Go to `public_html`.
3. Delete default Hostinger index files if present.
4. Upload **all contents** from `frontend/dist` into `public_html`.

Important: upload file contents, not the `dist` folder itself.

## 7) SPA routing fix on Hostinger (.htaccess)

Create `public_html/.htaccess` with:

```apacheconf
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /index.html [L]
```

## 8) Final verification

- Frontend: `https://<your-hostinger-domain>`
- Backend health: `https://<railway-backend-domain>/api/health`
- Login should work using seeded admin credentials.

## 9) If login/API fails

1. Check browser devtools network request URL -> should hit Railway backend.
2. Check Railway backend logs for CORS or DB errors.
3. Ensure backend `FRONTEND_URL` exactly matches your Hostinger domain(s).
4. Rebuild frontend after changing `VITE_API_URL` and re-upload `dist`.
