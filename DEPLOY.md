# ControlBox Deployment Guide

## DigitalOcean Deployment

### Option 1: App Platform (Recommended)

**Easiest setup with automatic deploys from GitHub.**

#### Steps

1. **Go to DigitalOcean App Platform**
   - https://cloud.digitalocean.com/apps

2. **Create App → GitHub → Select ControlBox repo**

3. **Configure Services**
   
   The `.do/app.yaml` will auto-configure, but verify:
   - **API**: Dockerfile, port 8080
   - **Dashboard**: Static site, `packages/dashboard`

4. **Add Environment Variables**
   
   | Variable | Type | Value |
   |----------|------|-------|
   | `DATABASE_URL` | Secret | From DO Managed DB or external |
   | `JWT_SECRET` | Secret | Generate: `openssl rand -hex 32` |
   | `CORS_ORIGINS` | Plain | Your dashboard URL |
   | `OPENAI_API_KEY` | Secret | Optional (has fallback) |
   | `DISCORD_BOT_TOKEN` | Secret | Optional |
   | `DO_SPACES_ENDPOINT` | Plain | `https://nyc3.digitaloceanspaces.com` |
   | `DO_SPACES_REGION` | Plain | `nyc3` |
   | `DO_SPACES_BUCKET` | Plain | Your Spaces bucket name |
   | `DO_SPACES_KEY` | Secret | Spaces access key |
   | `DO_SPACES_SECRET` | Secret | Spaces secret key |
   | `EVIDENCE_MAX_SIZE_MB` | Plain | `100` (optional) |

5. **Add Database**
   
   Either:
   - **Managed**: Add PostgreSQL component ($7/mo)
   - **External**: Use connection string from other provider

6. **Deploy**

---

### Option 2: Droplet with Docker

**More control, manual management.**

#### Setup

```bash
# SSH into droplet
ssh root@your-droplet-ip

# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone repo
git clone https://github.com/SingSongScreamAlong/ControlBox.git
cd ControlBox

# Create .env file
cat > .env << 'EOF'
DATABASE_URL=postgresql://controlbox:password@localhost:5432/controlbox
JWT_SECRET=your-secret-here
CORS_ORIGINS=https://your-domain.com
NODE_ENV=production
EOF

# Start everything
docker compose up -d

# Check status
docker compose ps
docker compose logs -f
```

#### With External Database

If using DO Managed PostgreSQL:

```bash
# Get connection string from DO dashboard
# Update .env with the connection string

# Start only app containers (not postgres)
docker compose up -d server dashboard
```

---

### Database Migrations

Migrations run automatically via Docker init scripts.

For manual migration:
```bash
# Connect to database
psql $DATABASE_URL

# Run migrations
\i packages/server/src/db/migrations/001_initial.sql
\i packages/server/src/db/migrations/002_discipline_profiles.sql
# ... etc
```

---

### SSL/HTTPS

**App Platform**: Automatic SSL included.

**Droplet**: Use Caddy or nginx with Let's Encrypt:

```bash
# Install Caddy
apt install caddy

# Caddyfile
cat > /etc/caddy/Caddyfile << 'EOF'
your-domain.com {
    reverse_proxy localhost:8080
}

dashboard.your-domain.com {
    reverse_proxy localhost:3000
}
EOF

# Restart Caddy
systemctl restart caddy
```

---

### Health Check

```bash
curl https://your-api-domain/api/health
# Expected: {"status":"ok","timestamp":"..."}
```

---

### Costs Estimate

| Component | App Platform | Droplet |
|-----------|--------------|---------|
| API Server | $5/mo | $6/mo (shared) |
| Dashboard | $3/mo | included |
| PostgreSQL | $7/mo | $7/mo (managed) |
| **Total** | **~$15/mo** | **~$13/mo** |

---

### Troubleshooting

**Build fails**
- Check Node version (needs 20+)
- Verify all packages install: `npm ci`

**Database connection fails**
- Verify `DATABASE_URL` format
- Check firewall/trusted sources on DO

**API returns 500**
- Check logs: `docker compose logs api`
- Verify environment variables set

**Dashboard can't reach API**
- Check `VITE_API_URL` matches API URL
- Verify CORS_ORIGINS includes dashboard domain
