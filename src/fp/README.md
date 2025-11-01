# Functional Programming Architecture with fp-ts

This directory contains a functional refactor of the OAuth2 token endpoint using `fp-ts`. The goal is to separate pure logic from side effects and provide better composability and type safety.

## Architecture Overview

### Key Concepts

1. **TaskEither<E, A>** - Represents async operations that can fail
   - `E` is the error type (Left)
   - `A` is the success type (Right)
   - All side effects (Redis, HTTP) are wrapped in TaskEither

2. **ReaderTaskEither<R, E, A>** - Dependency injection pattern
   - `R` is the environment/dependencies (AppEnvironment)
   - `E` is the error type
   - `A` is the success type
   - Business logic uses this to access services without globals

3. **io-ts Codecs** - Runtime type validation
   - Provides both compile-time types and runtime validation
   - Replaces manual JSON.parse + type assertions
   - Returns Either<ValidationError, T> for composability

4. **Algebraic Data Types (ADTs)** - Discriminated unions for errors
   - All errors have `_tag` field for exhaustive pattern matching
   - Type-safe error handling with no runtime exceptions

## Directory Structure

```
fp/
├── types.ts              # Core fp-ts type aliases
├── errors.ts             # ADT error types with constructors
├── domain.ts             # Domain types with io-ts codecs
├── validation.ts         # Pure validation functions
├── environment.ts        # Dependency injection types
├── bootstrap.ts          # Environment creation
├── services/
│   ├── redis.ts          # Redis operations as TaskEither
│   ├── google.ts         # Google OAuth as TaskEither
│   └── token.ts          # Core business logic with RTE
└── README.md             # This file
```

## Comparison: Imperative vs Functional

### Imperative Approach (passthrough-auth.ts)

```typescript
// Direct side effects, error handling with try/catch and .catch()
router.post("/token", async (req, res) => {
  const params = req.body

  if (params.grant_type == 'authorization_code') {
    const authCode = params.code
    const authDataStr = await redis.get(`auth_code:${authCode}`)
    const authData = JSON.parse(authDataStr || "")  // Can throw!

    await redis.del(`auth_code:${authCode}`)  // Side effect

    const isValidPKCE = validatePKCE(...)
    if (!isValidPKCE) {
      return res.status(400).json({ error: '...' })  // Early return
    }

    await redis.set(...).catch((err) => {  // Swallowed error
      jsonLogger.error(...)
    })

    res.json(resp)  // Implicit success
  }
})
```

**Problems:**
- Side effects mixed with business logic
- JSON.parse can throw uncaught exceptions
- Error handling is inconsistent (try/catch, .catch(), early returns)
- Global dependencies (redis, jsonLogger)
- Hard to test without mocking globals
- No type safety for parsed JSON

### Functional Approach (passthrough-auth-fp.ts)

```typescript
// Pure validation, explicit dependencies, composable error handling
export const processAuthCodeGrant = (
  grant: AuthCodeGrant
): RTE.ReaderTaskEither<AppEnvironment, AppError, OAuth2TokenResponse> =>
  pipe(
    RTE.ask<AppEnvironment>(),  // Get dependencies
    RTE.chainW((env) => {
      const redisOps = createOAuthRedisOps(env.redis)

      return pipe(
        // Fetch auth code + PKCE state (both TaskEither)
        RTE.fromTaskEither(
          pipe(
            TE.Do,
            TE.bindW('authData', () =>
              redisOps.getAuthCode(grant.code, AuthCodeDataCodec)  // Validated!
            ),
            TE.bindW('pkceState', () =>
              redisOps.getAuthCodeState(grant.code, PKCEStateCodec)
            )
          )
        ),

        // Clean up (side effect wrapped in TaskEither)
        RTE.chainFirstW(() =>
          RTE.fromTaskEither(redisOps.deleteAuthCode(grant.code))
        ),

        // Validate PKCE (pure function returning Either)
        RTE.chainW(({ authData, pkceState }) =>
          pipe(
            validatePKCE(
              grant.code_verifier,
              pkceState.code_challenge,
              pkceState.code_challenge_method
            ),
            RTE.fromEither,
            RTE.map(() => ({ authData, pkceState }))
          )
        ),

        // Store refresh token (side effect)
        RTE.chainW(({ authData, pkceState }) => {
          const refreshTokenData: RefreshTokenData = { ... }
          return pipe(
            RTE.fromTaskEither(
              redisOps.setRefreshToken(refreshTokenData.google_refresh_token, refreshTokenData)
            ),
            RTE.map(() => refreshTokenData)
          )
        }),

        // Build response (pure)
        RTE.map((refreshTokenData) => ({
          access_token: refreshTokenData.access_token,
          token_type: 'Bearer',
          expires_in: refreshTokenData.expires_in,
          refresh_token: refreshTokenData.google_refresh_token,
          scope: refreshTokenData.scope,
        }))
      )
    })
  )
```

**Benefits:**
- All side effects explicitly wrapped in TaskEither
- JSON parsing validated with io-ts codecs
- Consistent error handling via Either/TaskEither
- Dependencies injected via Reader pattern
- Testable without mocking (inject test environment)
- Full type safety including runtime validation
- Composable via pipe and chain operators
- No early returns - railway-oriented programming
- Errors are values, not exceptions

## Usage Example

### Setting up the Environment

```typescript
import redis from './setup/redis.js'
import jsonLogger from './logging.js'
import { appConfig } from './config.js'
import { createAppEnvironment } from './fp/bootstrap.js'

// Create functional environment from existing infrastructure
const env = createAppEnvironment(
  redis,
  jsonLogger,
  {
    googleClientId: process.env.GOOGLE_CLIENT_ID!,
    googleClientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    hydraUrl: appConfig.hydraInternalAdmin,
    redisHost: appConfig.redisHost,
    redisPort: appConfig.redisPort,
  }
)
```

### Using the Token Route

```typescript
import { createTokenRouter } from './routes/passthrough-auth-fp.js'

const app = express()
app.use('/oauth2', createTokenRouter(env))
```

### Testing Business Logic

```typescript
import { processAuthCodeGrant } from './fp/services/token.js'
import { AppEnvironment } from './fp/environment.js'

// Create test environment with mock services
const testEnv: AppEnvironment = {
  redis: createMockRedisService(),
  google: createMockGoogleService(),
  logger: createMockLogger(),
  config: testConfig,
}

// Test business logic
const grant: AuthCodeGrant = {
  grant_type: 'authorization_code',
  code: 'test_code',
  code_verifier: 'verifier',
  redirect_uri: 'http://example.com',
  client_id: 'client_123',
}

const result = await processAuthCodeGrant(grant)(testEnv)()

// Result is Either<AppError, OAuth2TokenResponse>
if (result._tag === 'Right') {
  console.log('Success:', result.right)
} else {
  console.error('Error:', result.left)
}
```

## Error Handling

All errors are discriminated unions with exhaustive pattern matching:

```typescript
const handleError = (error: AppError): void => {
  switch (error._tag) {
    case 'InvalidPKCE':
      console.error(`PKCE failed: ${error.challenge} vs ${error.verifier}`)
      break
    case 'RedisKeyNotFound':
      console.error(`Redis key not found: ${error.key}`)
      break
    case 'GoogleAuthError':
      console.error(`Google error: ${error.error}`)
      break
    // TypeScript ensures all cases are covered
  }
}
```

## Pure vs IO Separation

### Pure Functions (validation.ts)
- PKCE validation
- Scope validation
- String parsing
- No side effects
- Fully testable with simple inputs

### IO Operations (services/*)
- Redis get/set/delete
- HTTP requests to Google
- Logging
- All wrapped in TaskEither
- Dependencies injected via Reader

### Business Logic (services/token.ts)
- Combines pure functions and IO operations
- Uses ReaderTaskEither for composition
- Reads like a pipeline of transformations
- No imperative control flow

## Migration Strategy

To migrate other routes to functional style:

1. **Identify side effects** - Redis, HTTP, database, logging
2. **Extract pure functions** - Validation, transformation, parsing
3. **Create io-ts codecs** - For all external data (JSON, request bodies)
4. **Wrap IO in TaskEither** - Use service interfaces
5. **Compose with pipe** - Chain operations using RTE
6. **Handle errors as values** - Map AppError to HTTP responses

## Benefits Summary

✓ **Type Safety**: io-ts provides runtime validation matching compile-time types
✓ **Testability**: Dependency injection makes testing trivial
✓ **Composability**: pipe and chain create readable data pipelines
✓ **Error Handling**: Errors are values, exhaustively handled
✓ **Separation of Concerns**: Pure logic separated from IO
✓ **No Exceptions**: All failures are explicit Either/TaskEither
✓ **Referential Transparency**: Functions are predictable and cacheable
✓ **Parallelism**: TaskEither operations can run concurrently with `sequenceT`

## Next Steps

- Migrate other routes (login, consent, callback) to functional style
- Add property-based testing with fast-check
- Create reusable combinators for common patterns
- Add metrics/observability as Reader dependencies
- Implement retry logic using TaskEither combinators
