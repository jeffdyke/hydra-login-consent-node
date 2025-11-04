# Configuration Migration Guide

This document explains the new type-safe functional configuration system and how to migrate from the legacy configuration.

## Overview

The configuration has been migrated from class-based (`DevAppConfig`, `StagingAppConfig`) to a functional, type-safe system using Effect's Config service.

### Key Benefits

1. **Type Safety**: All configuration is validated at runtime with proper TypeScript types
2. **Environment Variables**: 12-factor app approach - all config from environment
3. **Composability**: Uses Effect for testable, composable configuration
4. **Validation**: Invalid configuration fails fast with clear error messages
5. **Domain-Based**: Separates public domains from private IPs for security

## Configuration Structure

### Domain Configuration

The new system uses a domain-based approach:

```typescript
{
  domain: {
    public: "auth.staging.bondlink.org",  // Public-facing domain
    private: "10.1.1.230"                  // Private IP for internal services
  }
}
```

**Benefits**:
- Clear separation of public vs internal communication
- Security: Internal services use private IPs
- Flexibility: Different networks for different purposes

### Service Configuration

Each service (Hydra, Redis, Database) has structured configuration:

```typescript
{
  hydra: {
    public: {
      url: "https://auth.staging.bondlink.org",
      port: 4444
    },
    admin: {
      host: "10.1.1.230",  // Private IP
      port: 4445
    }
  },
  redis: {
    host: "10.1.1.230",    // Private IP
    port: 16379
  },
  database: {
    dsn: "postgres://...",
    host: "10.1.1.230",
    port: 5432,
    user: "hydra",
    password: "...",
    database: "hydra"
  }
}
```

## Environment Variables

### Required Variables

#### All Environments
- `APP_ENV`: Environment type (local, development, staging, production)
- `BASE_URL`: Base URL for the application

#### Non-Local Environments
- `GOOGLE_CLIENT_ID`: Google OAuth client ID (required for dev/staging/prod)
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret (required for dev/staging/prod)
- `PUBLIC_DOMAIN`: Public-facing domain
- `PRIVATE_HOST`: Private IP/host for internal services

### Optional Variables with Defaults

#### Local Environment
- `LOCAL_DOMAIN`: Defaults to `localhost`
- `PORT`: Defaults to `3000`

#### All Environments
- `REDIS_HOST`: Defaults to private host
- `REDIS_PORT`: Defaults to `6379` (local) or `16379` (others)
- `POSTGRES_HOST`: Defaults to private host
- `POSTGRES_PORT`: Defaults to `5432`
- `POSTGRES_USER`: Defaults to `hydra`
- `POSTGRES_PASSWORD`: Defaults to `my-super-secret-password`
- `POSTGRES_DB`: Defaults to `hydra`
- `SESSION_SECRET`: Defaults to environment-specific value
- `COOKIE_SECRET`: Has default value
- `MOCK_TLS_TERMINATION`: Defaults to `false`

## Migration Examples

### Local Development (.env)

```bash
APP_ENV=local
BASE_URL=http://localhost:3000
LOCAL_DOMAIN=localhost
PORT=3000
DCR_MASTER_CLIENT_ID=your-client-id
```

**What happens**:
- Both public and private domains set to `localhost`
- Hydra URLs constructed: `http://localhost:4444`, `http://localhost:4445`
- Redis: `localhost:6379`
- Google OAuth: Optional (clientId/clientSecret can be undefined)

### Development (.env)

```bash
APP_ENV=development
BASE_URL=http://dev.bondlink.org:3000
PUBLIC_DOMAIN=dev.bondlink.org
PRIVATE_HOST=dev.bondlink.org
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret
```

### Staging (.env)

```bash
APP_ENV=staging
BASE_URL=https://auth.staging.bondlink.org
PUBLIC_DOMAIN=auth.staging.bondlink.org
PRIVATE_HOST=10.1.1.230

# Hydra
HYDRA_PUBLIC_URL=https://auth.staging.bondlink.org
HYDRA_ADMIN_HOST=10.1.1.230
HYDRA_ADMIN_PORT=4445

# Redis
REDIS_HOST=10.1.1.230
REDIS_PORT=16379

# Database
DSN=postgres://hydra:password@10.1.1.230:5432/hydra
POSTGRES_HOST=10.1.1.230

# Google OAuth
GOOGLE_CLIENT_ID=your-staging-client-id
GOOGLE_CLIENT_SECRET=your-staging-secret
GOOGLE_REDIRECT_URI=https://auth.staging.bondlink.org/callback
```

## Code Usage

### Loading Configuration

The configuration is automatically loaded when the application starts:

```typescript
import { appConfig } from './config.js'

// Access configuration
console.log(appConfig.baseUrl)
console.log(appConfig.redis.host)
console.log(appConfig.hydra.admin.host)
```

### Using with Effect

For Effect-based code, use the service layer:

```typescript
import { AppConfigService, AppConfigLive } from './fp/config.js'
import { Effect, Layer } from 'effect'

const program = Effect.gen(function* () {
  const config = yield* AppConfigService
  console.log(config.baseUrl)
})

// Provide the config layer
Effect.runPromise(Effect.provide(program, AppConfigLive))
```

## Legacy Compatibility

The new configuration maintains backwards compatibility with legacy code:

```typescript
// Old property names still work
appConfig.hostName           // → appConfig.baseUrl
appConfig.hydraInternalAdmin // → constructed URL
appConfig.redisHost          // → appConfig.redis.host
appConfig.redisPort          // → appConfig.redis.port
```

## URL Construction

URLs are constructed intelligently based on configuration:

### Public Hydra URL
```typescript
// Uses hydra.public.url directly
// Example: https://auth.staging.bondlink.org
```

### Admin Hydra URL
```typescript
// Constructed from hydra.admin.host:port
// Example: http://10.1.1.230:4445
```

### Internal Hydra URL (for proxying)
```typescript
// Constructed from domain.private:hydra.public.port
// Example: http://10.1.1.230:4444
```

## Validation

Configuration is validated on load:

```typescript
// If BASE_URL is missing, you'll get:
// ConfigError: Expected BASE_URL to be set

// If APP_ENV is invalid, you'll get:
// ConfigError: Invalid APP_ENV, must be: local, development, staging, or production
```

## Testing

For testing, you can create a test configuration:

```typescript
import { loadAppConfigSync } from './fp/config.js'

// Set test environment variables
process.env.APP_ENV = 'local'
process.env.BASE_URL = 'http://test:3000'

const config = loadAppConfigSync()
expect(config.environment).toBe('local')
```

## Migration Checklist

- [ ] Copy `.env.example` to `.env`
- [ ] Set `APP_ENV` appropriately
- [ ] Set `BASE_URL`
- [ ] For non-local: Set `PUBLIC_DOMAIN` and `PRIVATE_HOST`
- [ ] For non-local: Set Google OAuth credentials
- [ ] Review and update any custom configuration
- [ ] Test the application starts successfully
- [ ] Verify all services connect properly

## Troubleshooting

### "Expected BASE_URL to be set"
**Solution**: Add `BASE_URL=http://your-domain:port` to your `.env` file

### "Google OAuth required for non-local environments"
**Solution**: Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to your `.env` file, or set `APP_ENV=local`

### URLs not constructed correctly
**Solution**: Verify `PUBLIC_DOMAIN` and `PRIVATE_HOST` are set correctly. For staging, ensure they match your actual infrastructure.

### Redis/Database connection fails
**Solution**: Check `REDIS_HOST`, `POSTGRES_HOST` point to the correct private IPs. Verify ports are accessible.

## Files

- `src/fp/config.ts`: New functional configuration implementation
- `src/config.ts`: Backwards-compatible configuration export
- `.env.example`: Example environment configuration
- `stage_env/localdev.env`: Local development example
- `stage_env/staging.env`: Staging environment example
