# Migration Guide: Functional Refactor

This guide explains how to use the functional programming refactor of the OAuth2/Hydra integration.

## Branch Information

The functional refactor is on the `functional-refactor` branch. All routes have been refactored using fp-ts.

## Quick Start

### Option 1: Run the Functional Version

```bash
# Build the project
npm run build

# Run functional version (app-fp.ts)
npm run serve:fp

# Or for development with auto-reload
npm run start:fp
```

### Option 2: Keep Running the Original

```bash
# Run original version (app.ts)
npm run serve

# Or for development
npm start
```

## What's New

### File Structure

```
src/
├── fp/                           # Functional core
│   ├── types.ts                  # fp-ts type aliases
│   ├── errors.ts                 # ADT error types
│   ├── domain.ts                 # io-ts codecs
│   ├── validation.ts             # Pure functions
│   ├── environment.ts            # DI types
│   ├── bootstrap.ts              # Environment setup
│   ├── services/
│   │   ├── redis.ts              # Redis with TaskEither
│   │   ├── google.ts             # Google OAuth with TaskEither
│   │   ├── hydra.ts              # Hydra API with TaskEither
│   │   ├── token.ts              # Token business logic (RTE)
│   │   ├── login.ts              # Login business logic (RTE)
│   │   ├── consent.ts            # Consent business logic (RTE)
│   │   ├── callback.ts           # Callback business logic (RTE)
│   │   └── logout.ts             # Logout business logic (RTE)
│   └── README.md                 # Functional architecture docs
├── routes/
│   ├── login-fp.ts               # Functional login route
│   ├── consent-fp.ts             # Functional consent route
│   ├── callback-fp.ts            # Functional callback route
│   ├── logout-fp.ts              # Functional logout route
│   └── passthrough-auth-fp.ts    # Functional token endpoint
├── app.ts                        # Original imperative app
└── app-fp.ts                     # NEW: Functional app entry point
```

## Refactored Routes

All the following routes have been converted to functional style:

### 1. **POST /oauth2/token** ([passthrough-auth-fp.ts](src/routes/passthrough-auth-fp.ts))
- Authorization code grant
- Refresh token grant
- Full PKCE validation
- io-ts runtime validation
- Composable error handling

### 2. **GET/POST /login** ([login-fp.ts](src/routes/login-fp.ts))
- Auto-accepts login with subject
- Hydra API wrapped in TaskEither
- Proper error propagation

### 3. **GET /consent** ([consent-fp.ts](src/routes/consent-fp.ts))
- Fetches consent info
- Accepts consent
- Redirects to Google OAuth

### 4. **GET /callback** ([callback-fp.ts](src/routes/callback-fp.ts))
- Exchanges Google auth code for tokens
- Generates passthrough auth_code
- Stores in Redis with proper error handling
- Cleans up PKCE session

### 5. **GET/POST /logout** ([logout-fp.ts](src/routes/logout-fp.ts))
- Renders logout confirmation
- Accepts or rejects logout
- Hydra API integration

## Key Differences

### Imperative (Original)

```typescript
// Direct side effects
const authDataStr = await redis.get(`auth_code:${authCode}`)
const authData = JSON.parse(authDataStr || "")  // Can throw!

// Swallowed errors
await redis.set(...).catch((err) => {
  jsonLogger.error(...)  // Error logged but not handled
})

// Early returns
if (!isValidPKCE) {
  return res.status(400).json({ error: '...' })
}
```

### Functional (fp-ts)

```typescript
// Side effects wrapped in TaskEither
const authData = redisOps.getAuthCode(grant.code, AuthCodeDataCodec)
// Returns: TaskEither<RedisError | ValidationError, AuthCodeData>

// Errors propagate through Either
pipe(
  validatePKCE(...),
  RTE.fromEither,  // Lift Either to RTE
  RTE.chainW(...)  // Continue on success, short-circuit on error
)

// No early returns - railway-oriented programming
```

## Testing

### Unit Testing Business Logic

```typescript
import { processAuthCodeGrant } from './fp/services/token.js'
import { AppEnvironment } from './fp/environment.js'

// Create test environment with mocks
const testEnv: AppEnvironment = {
  redis: createMockRedisService(),
  google: createMockGoogleService(),
  hydra: createMockHydraService(),
  logger: createMockLogger(),
  config: testConfig,
}

// Test business logic
const grant: AuthCodeGrant = { /* ... */ }
const result = await processAuthCodeGrant(grant)(testEnv)()

// result is Either<AppError, OAuth2TokenResponse>
expect(result._tag).toBe('Right')
```

### Integration Testing

```typescript
// Original app
import app from './app.js'
const response = await request(app)
  .post('/oauth2/token')
  .send({ grant_type: 'authorization_code', /* ... */ })

// Functional app
import appFp from './app-fp.js'
const response = await request(appFp)
  .post('/oauth2/token')
  .send({ grant_type: 'authorization_code', /* ... */ })
```

## Configuration

Both apps use the same configuration from `config.ts`. No environment variable changes needed.

## Performance

The functional version has similar performance to the imperative version:

- **TaskEither** operations are lazy (only execute when called)
- **pipe** compiles to efficient function calls
- **io-ts** validation adds minimal overhead (one-time parse)
- Async operations can be parallelized with `sequenceT`

## Rollback Strategy

If you need to rollback to the imperative version:

```bash
# Switch back to master
git checkout master

# Or keep both and use a flag
USE_FP_VERSION=false npm start
```

## Migration Checklist

If you want to continue migrating other parts of the codebase:

- [ ] Migrate `/routes/index.ts` (root route)
- [ ] Migrate `/routes/device.ts` (device flow)
- [ ] Add property-based tests with `fast-check`
- [ ] Add retry logic for HTTP operations
- [ ] Add circuit breakers for external services
- [ ] Implement caching with `TaskEither`
- [ ] Add metrics/observability

## Benefits Summary

✅ **Type Safety**: io-ts provides compile-time + runtime validation
✅ **Testability**: Dependency injection makes mocking trivial
✅ **Error Handling**: All errors are values, exhaustively handled
✅ **Composability**: pipe and chain create readable pipelines
✅ **No Exceptions**: All failures are explicit Either/TaskEither
✅ **Separation of Concerns**: Pure logic separated from IO
✅ **Maintainability**: Clear boundaries between layers

## Further Reading

- [fp-ts Documentation](https://gcanti.github.io/fp-ts/)
- [io-ts Documentation](https://gcanti.github.io/io-ts/)
- [Functional Architecture README](src/fp/README.md)
- [Detailed Comparison](FUNCTIONAL_REFACTOR.md)

## Support

For questions or issues with the functional refactor:

1. Review the [fp/README.md](src/fp/README.md)
2. Check the [FUNCTIONAL_REFACTOR.md](FUNCTIONAL_REFACTOR.md) comparison
3. Look at test files for examples
4. Open an issue with `[functional-refactor]` tag
