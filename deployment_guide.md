# 🚀 ContractLens — 100% Free Deployment Guide

## Free Services Used (All Forever Free)

| Service | Platform | Cost |
|---|---|---|
| Frontend (Next.js) | **Vercel** | ✅ Free forever |
| API + Agent + Ingestion | **Render.com** | ✅ Free (sleeps after 15min idle) |
| PostgreSQL | **Neon.tech** | ✅ Free forever (0.5GB) |
| Redis | **Upstash** | ✅ Free forever (10K req/day) |
| LLM (Groq) | **Groq Cloud** | ✅ Free tier (generous limits) |

> [!IMPORTANT]
> Render's free services **sleep after 15 min of inactivity** — first request takes ~30 seconds to wake up. This is the only downside of the free tier.

---

## STEP 1 — Push Code to GitHub

1. Go to [github.com/new](https://github.com/new)
2. Create a repo named **`ContractLens`** (set to Public or Private)
3. Open terminal in your project folder and run:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/ContractLens.git
git push -u origin main
```

---

## STEP 2 — Get a Free Groq API Key (LLM)

> Groq is a FREE, ultra-fast LLM API. No credit card needed.

1. Go to → **[console.groq.com](https://console.groq.com)**
2. Sign up with Google/GitHub
3. Click **API Keys → Create API Key**
4. Copy the key → looks like `gsk_xxxxxxxxxxxx`
5. Save it — you'll need it in Steps 3 & 4

---

## STEP 3 — Set Up Free PostgreSQL on Neon.tech

> Better than Render's PostgreSQL (free forever, no 90-day limit)

1. Go to → **[neon.tech](https://neon.tech)**
2. Sign up → Create a new project named **`ContractLens`**
3. On the dashboard, click **"Connection Details"**
4. Copy the **Connection String** → looks like:
   ```
   postgresql://ContractLens_owner:xxxx@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Save it — used in Step 4

---

## STEP 4 — Set Up Free Redis on Upstash

1. Go to → **[upstash.com](https://upstash.com)**
2. Sign up → Create a database named **`ContractLens-redis`**
3. Select region: **US-East-1** (free)
4. Copy **Redis URL** → looks like:
   ```
   rediss://default:xxxxx@xxx.upstash.io:6379
   ```
5. Save it — used in Step 5

---

## STEP 5 — Deploy Backend to Render.com

1. Go to → **[render.com](https://render.com)** → Sign up
2. Click **"New +"** → Select **"Blueprint"**
3. Connect your GitHub → Select the **ContractLens** repo
4. Render will auto-detect `render.yaml` → click **"Apply"**
5. It will create 3 web services + 1 Redis

### Set Environment Variables on Each Service

In Render dashboard, for **each** of the 3 services (`ContractLens-api`, `ContractLens-agent`, `ContractLens-ingestion`), go to **Environment** tab and add:

| Key | Value |
|---|---|
| `DATABASE_URL` | Paste your Neon.tech connection string |
| `REDIS_URL` | Paste your Upstash Redis URL |
| `GROQ_API_KEY` | Paste your Groq API key |
| `SECRET_KEY` | Any 32+ char random string (e.g. `mySuperSecret123!@#mySuperSecret123!@#`) |
| `ENCRYPTION_KEY` | Generate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `MOCK_MCP` | `true` |
| `FRONTEND_URL` | Your Vercel URL (fill after Step 6) |

### After Deploy, Copy Your API URL
- Your API will be at: `https://ContractLens-api.onrender.com`
- Your agent will be at: `https://ContractLens-agent.onrender.com`
- Add `AGENT_SERVICE_URL=https://ContractLens-agent.onrender.com` to `ContractLens-api`

---

## STEP 6 — Deploy Frontend to Vercel

1. Go to → **[vercel.com](https://vercel.com)** → Sign up with GitHub
2. Click **"Add New Project"** → Import **ContractLens** repo
3. Set **Root Directory** to: `frontend`
4. Add Environment Variable:
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: `https://ContractLens-api.onrender.com`
5. Click **Deploy** 🚀

Your app will be live at: `https://ContractLens-xxxx.vercel.app`

---

## STEP 7 — Run Database Migrations

After Render deploys, run the database setup once:

1. In Render dashboard → open **ContractLens-api** service
2. Click **"Shell"** tab
3. Run:
```bash
alembic upgrade head
```

---

## STEP 8 — Update CORS Settings

In your Render `ContractLens-api` service, add:
```
FRONTEND_URL=https://ContractLens-xxxx.vercel.app
```
(Use your actual Vercel URL from Step 6)

---

## ✅ Final Architecture (All Free)

```
User Browser
    │
    ▼
Vercel (Next.js Frontend)   ← Free, fast, global CDN
    │
    │ /api/* requests
    ▼
Render (FastAPI API Gateway) ← Free, sleeps when idle
    │
    ├──► Render (Agent Service + LangGraph + Groq LLM)
    ├──► Render (Ingestion Service)
    ├──► Neon.tech PostgreSQL ← Free, always on
    └──► Upstash Redis ← Free, always on
```

---

## 💡 Tips

- **Wake-up lag**: Add a simple loading spinner in your UI for first request (Render free services sleep)
- **Keep-alive**: Use [cron-job.org](https://cron-job.org) (free) to ping `https://ContractLens-api.onrender.com/health` every 14 minutes to prevent sleeping
- **Groq free limits**: ~14,400 requests/day on free tier — more than enough for demos
- **Upgrade later**: If you need always-on, Render's paid tier starts at $7/month

---

## 🔗 Quick Links

| Service | URL |
|---|---|
| Groq Console | https://console.groq.com |
| Neon Database | https://neon.tech |
| Upstash Redis | https://upstash.com |
| Render Backend | https://render.com |
| Vercel Frontend | https://vercel.com |
| Cron Keep-alive | https://cron-job.org |

