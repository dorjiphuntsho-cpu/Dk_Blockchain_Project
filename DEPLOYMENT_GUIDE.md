# Deployment Guide

## Overview

This guide covers production deployment for the frontend, backend, and Solana environment.

## Environment Setup

1. Copy environment templates.

Backend:

```powershell
Copy-Item backend\.env.example backend\.env -Force
```

Frontend:

```powershell
Copy-Item DK_Token_Frontend\.env.example DK_Token_Frontend\.env -Force
```

2. Update the copied files with production values.

3. Ensure the database is accessible from the backend host.

## Backend Deployment

### Install dependencies

```bash
cd backend
npm install
```

### Generate Prisma client

```bash
npm run prisma:generate
```

### Run database migrations

```bash
npm run prisma:migrate
```

### Start backend

Local development:

```bash
npm run dev
```

Production:

```bash
npm start
```

### PM2 example

```bash
pm install -g pm2
pm run build
pm start
pm2 start src/server.js --name dk-admin-backend
pm2 save
```

## Frontend Deployment

### Install dependencies

```bash
cd DK_Token_Frontend
npm install
```

### Build

```bash
npm run build
```

### Serve static files

Use a static file server or CDN. Example with Nginx:

```nginx
server {
  listen 80;
  server_name example.com;

  root /var/www/dk-token-frontend/dist;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:5000/api/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
  }
}
```

## Nginx Setup

- serve the frontend build from the `dist` folder
- proxy `/api` to the backend
- enable `gzip` and HTTP/2
- add security headers for XSS and clickjacking

## SSL / TLS

- use Let's Encrypt or your corporate certificate provider
- configure `ssl_certificate` and `ssl_certificate_key` in Nginx
- redirect HTTP traffic to HTTPS

## Solana RPC Configuration

- Use a production-grade RPC provider for mainnet/devnet
- Avoid local validator URLs in production
- Set `SOLANA_RPC_URL` accordingly in `backend/.env`

## Health Checks

- Backend exposes `/health`
- Use liveness/readiness probes in container orchestration

## Deployment Checklist

- verify `DATABASE_URL` and database connection
- confirm `JWT_SECRET` is set and secured
- validate `SOLANA_PROGRAM_ID` and program IDL path
- ensure `VITE_API_BASE_URL` points to production backend
- build and test frontend assets before deployment
- review Nginx proxy rules and enable HTTPS
- monitor logs and set alerts for failures






deployment script
anchor deploy --provider.cluster devnet --provider.wallet /mnt/c/Users/itand/.config/solana/admin-devnet.json