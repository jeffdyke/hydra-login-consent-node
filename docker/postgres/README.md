# PostgreSQL Session Storage Setup

## Overview

This directory contains initialization scripts for PostgreSQL that are automatically executed when the database container is first created.

## Session Table

The `init-session-table.sql` script creates the `session` table required by `connect-pg-simple` for storing Express session data used in OAuth2 flows.

### Table Schema

```sql
CREATE TABLE "session" (
  "sid" varchar NOT NULL,      -- Session ID (primary key)
  "sess" json NOT NULL,         -- Session data (JSON)
  "expire" timestamp(6) NOT NULL -- Expiration timestamp
)
```

### Idempotency

The script uses `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` to ensure it can be run multiple times safely without errors. This is important because:

- PostgreSQL's `docker-entrypoint-initdb.d` only runs scripts on **first container creation**
- The scripts are **not re-run** when the container restarts
- If you need to re-initialize, you must delete the volume: `docker volume rm hydra_postgres-data`

## Usage

### First Time Setup

```bash
# Start all services (postgres will auto-initialize)
docker-compose up -d

# Check logs to verify table creation
docker-compose logs postgres | grep "Session table"
```

You should see:
```
postgres  | Session table initialization complete
postgres  | Table: session
postgres  | Purpose: Express session storage for OAuth2 flows
postgres  | Used by: connect-pg-simple middleware
```

### Verify Table Creation

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U hydra -d hydra

# Check if table exists
\dt session

# View table schema
\d session

# Exit
\q
```

### Re-initialization (Clean Slate)

If you need to completely reset the database:

```bash
# Stop all services
docker-compose down

# Remove the postgres volume
docker volume rm hydra_postgres-data

# Start services (will re-run init scripts)
docker-compose up -d
```

## OAuth2 Flow Context

The session table stores Express session data for OAuth2 authorization flows:

- **PKCE State**: Temporary storage during authorization code flow
- **Login/Consent Challenges**: Session data from Hydra flows
- **User Session**: Authenticated user session across requests
- **CSRF Tokens**: Session-based CSRF protection

Session data is stored in PostgreSQL instead of memory/Redis to ensure:
- **Persistence**: Sessions survive application restarts
- **Scalability**: Multiple application instances share session storage
- **Security**: Session data encrypted and isolated per user

## Configuration

Session storage is configured in [src/app-fp.ts](../../src/app-fp.ts):

```typescript
import { PgStore } from './config.js'

app.use(session({
  store: new PgStore({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  proxy: true,
}))
```

## Database Connection

Connection details are configured via environment variables:

```bash
# Default values (local development)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=hydra
POSTGRES_PASSWORD=my-super-secret-password
POSTGRES_DB=hydra

# Connection string (DSN)
DSN=postgres://hydra:my-super-secret-password@localhost:5432/hydra?sslmode=disable
```

See [src/fp/config.ts](../../src/fp/config.ts) for full configuration details.

## Troubleshooting

### Table Not Created

**Problem**: Application fails with "relation 'session' does not exist"

**Solution**:
1. Check if volume was created before init script existed:
   ```bash
   docker volume ls | grep postgres
   ```
2. If volume exists, remove it and recreate:
   ```bash
   docker-compose down
   docker volume rm hydra_postgres-data
   docker-compose up -d
   ```

### Permission Denied

**Problem**: Application can't write to session table

**Solution**: The init script grants permissions, but if you created the table manually:
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON "session" TO hydra;
```

### Connection Refused

**Problem**: Application can't connect to PostgreSQL

**Solution**:
1. Check if PostgreSQL is running:
   ```bash
   docker-compose ps postgres
   ```
2. Check healthcheck status:
   ```bash
   docker-compose ps postgres | grep healthy
   ```
3. Verify connection string in environment:
   ```bash
   docker-compose exec headless-ts env | grep DSN
   ```

## Development vs Production

### Development (Docker Compose)
- PostgreSQL runs in Docker container
- Data persists in named volume `postgres-data`
- Scripts in `docker-entrypoint-initdb.d/` auto-run on first start

### Production
- Use managed PostgreSQL (RDS, Cloud SQL, etc.)
- Run init script manually or via migration tool
- Set appropriate `sslmode` (not `disable`)
- Use strong passwords (not defaults)

## Related Documentation

- [OAUTH2_ARCHITECTURE.md](../../OAUTH2_ARCHITECTURE.md) - OAuth2 flow architecture
- [src/fp/config.ts](../../src/fp/config.ts) - Database configuration
- [src/pool.ts](../../src/pool.ts) - PostgreSQL connection pool
- [connect-pg-simple](https://github.com/voxpelli/node-connect-pg-simple) - Session store documentation
