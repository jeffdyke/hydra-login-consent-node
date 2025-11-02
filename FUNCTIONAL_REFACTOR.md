# Functional Programming Refactor with fp-ts

This document explains the functional refactoring of the OAuth2 token endpoint from an imperative to a functional paradigm using `fp-ts`.

## What Changed

### Before (Imperative - passthrough-auth.ts:10-164)

**Characteristics:**
- Direct side effects (Redis, HTTP) mixed with business logic
- Error handling with try/catch, .catch(), and early returns
- Global dependencies imported at module level
- Manual JSON parsing without validation
- Implicit control flow with nested if/else
- Errors as exceptions

### After (Functional - passthrough-auth-fp.ts)

**Characteristics:**
- All side effects wrapped in `TaskEither`
- Consistent error handling via `Either` type
- Dependency injection via `ReaderTaskEither`
- Runtime validation with io-ts codecs
- Explicit data pipelines using `pipe`
- Errors as values (ADTs)

## File Structure

### New Functional Core (`src/fp/`)

```
fp/
├── types.ts              # Type aliases (TaskEither, ReaderTaskEither)
├── errors.ts             # ADT error types
├── domain.ts             # Domain types + io-ts codecs
├── validation.ts         # Pure validation functions
├── environment.ts        # Dependency injection types
├── bootstrap.ts          # Environment creation
├── services/
│   ├── redis.ts          # Redis as TaskEither
│   ├── google.ts         # Google OAuth as TaskEither
│   └── token.ts          # Business logic with RTE
└── README.md
```

## Code Comparison: Authorization Code Grant

### Imperative Version (166 lines, mixed concerns)

```typescript
// passthrough-auth.ts:10-68
router.post("/token", async (req,res) => {
  const params = req.body

  if (params.grant_type == 'authorization_code') {
    const authCode = params.code

    // Direct Redis call (side effect)
    const authDataStr = await redis.get(`auth_code:${authCode}`)

    // Unsafe JSON parsing - can throw!
    const authData = JSON.parse(authDataStr || "")

    // Another side effect
    const pkceState = await pkceStateByKey(`auth_code_state:${authCode}`)

    // Cleanup (side effects)
    await redis.del(`auth_code:${authCode}`);
    await redis.del(`auth_code_state:${authCode}`)
    delete req.session.pkceKey

    // Pure validation (good!)
    const isValidPKCE = validatePKCE(
      params.code_verifier,
      pkceState.code_challenge,
      pkceState.code_challenge_method
    )

    // Early return pattern
    if (!isValidPKCE) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'PKCE validation failed'
      })
    }

    // Build response object
    const refreshTokenO = { ... }

    // Side effect with swallowed error
    await redis.set(`refresh_token:${refreshTokenO.refresh_token}`,
      JSON.stringify(refreshTokenO),
      'EX',
      60 * 60 * 24 * 30
    ).catch((err) => {
      jsonLogger.error("Failed to write refresh token data", {...})
    });

    // Success response
    res.json(resp);
  }
})
```

**Issues:**
1. JSON.parse can throw - no type safety
2. Redis errors are caught but logged and ignored
3. Global dependencies (redis, jsonLogger)
4. Mixed side effects and business logic
5. Early returns make control flow implicit
6. No validation of parsed JSON structure

### Functional Version (pipeline, separated concerns)

```typescript
// passthrough-auth-fp.ts + services/token.ts
export const processAuthCodeGrant = (
  grant: AuthCodeGrant  // Already validated by io-ts!
): RTE.ReaderTaskEither<AppEnvironment, AppError, OAuth2TokenResponse> =>
  pipe(
    RTE.ask<AppEnvironment>(),  // Get dependencies

    RTE.chainW((env) => {
      const redisOps = createOAuthRedisOps(env.redis)

      return pipe(
        // Step 1: Fetch data (both validated with io-ts)
        RTE.fromTaskEither(
          pipe(
            TE.Do,
            TE.bindW('authData', () =>
              redisOps.getAuthCode(grant.code, AuthCodeDataCodec)  // Type-safe!
            ),
            TE.bindW('pkceState', () =>
              redisOps.getAuthCodeState(grant.code, PKCEStateCodec)
            )
          )
        ),

        // Step 2: Cleanup (errors propagate automatically)
        RTE.chainFirstW(() =>
          RTE.fromTaskEither(
            pipe(
              TE.Do,
              TE.chainW(() => redisOps.deleteAuthCode(grant.code)),
              TE.chainW(() => redisOps.deleteAuthCodeState(grant.code))
            )
          )
        ),

        // Step 3: Validate PKCE (pure function)
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

        // Step 4: Build and store refresh token
        RTE.chainW(({ authData, pkceState }) => {
          const refreshTokenData: RefreshTokenData = { ... }

          return pipe(
            RTE.fromTaskEither(
              redisOps.setRefreshToken(
                refreshTokenData.refresh_token,
                refreshTokenData
              )
            ),
            RTE.map(() => refreshTokenData)
          )
        }),

        // Step 5: Build OAuth2 response (pure)
        RTE.map((refreshTokenData) => ({
          access_token: refreshTokenData.access_token,
          token_type: 'Bearer',
          expires_in: refreshTokenData.expires_in,
          refresh_token: refreshTokenData.refresh_token,
          scope: refreshTokenData.scope,
        }))
      )
    })
  )
```

**Benefits:**
1. io-ts validates all JSON - compile-time and runtime safety
2. Redis errors propagate through Either - no swallowed errors
3. Dependencies injected via Reader - testable
4. Pure and impure code clearly separated
5. Explicit pipeline - railway-oriented programming
6. All errors are typed AppError values

## Type Safety Comparison

### Imperative: Runtime Errors

```typescript
const authData = JSON.parse(authDataStr || "")  // any type!
const tokenObj = authData.google_tokens.tokens  // Can be undefined at runtime
```

If Redis returns malformed JSON or the structure changes, you get:
- `SyntaxError: Unexpected token` at runtime
- `TypeError: Cannot read property 'tokens' of undefined`

### Functional: Compile-time + Runtime Safety

```typescript
// io-ts codec defines structure
export const AuthCodeDataCodec = t.type({
  google_tokens: t.type({
    tokens: GoogleTokenResponseCodec,
  }),
  subject: t.union([t.string, t.undefined]),
})

// Validated fetch
redisOps.getAuthCode(grant.code, AuthCodeDataCodec)
// Returns: TaskEither<RedisError | ValidationError, AuthCodeData>
```

If Redis returns malformed JSON:
- Returns `Left(RedisParseError)` - no exception thrown
- Type system guarantees authData.google_tokens.tokens exists
- Compiler enforces handling of error case

## Error Handling Comparison

### Imperative: Mixed Strategies

```typescript
// Strategy 1: Early return
if (!isValidPKCE) {
  return res.status(400).json({ error: '...' })
}

// Strategy 2: Swallowed errors
await redis.set(...).catch((err) => {
  jsonLogger.error(...)  // Log and continue!
})

// Strategy 3: Unhandled promise rejection
const tokenDataStr = await redis.get(fetchName).then(resp => {
  if (!resp) {
    new Error(...)  // Created but not thrown!
  }
  return resp
})
```

### Functional: Consistent Either

```typescript
// All errors are Either<AppError, A>
const result: Either<AppError, OAuth2TokenResponse> = await pipeline()

// Single error handling point
pipe(
  result,
  E.fold(
    (error) => {
      const { status, body } = mapErrorToOAuth2(error)
      res.status(status).json(body)
    },
    (success) => res.json(success)
  )
)
```

**All errors flow through the same type:**
- RedisError
- ValidationError
- OAuthError
- GoogleOAuthError

**Pattern matching with exhaustive checks:**

```typescript
switch (error._tag) {
  case 'RedisKeyNotFound': ...
  case 'InvalidPKCE': ...
  case 'GoogleAuthError': ...
  // TypeScript ensures all cases covered
}
```

## Dependency Injection

### Imperative: Global Imports

```typescript
import redis from "../setup/redis.js"
import jsonLogger from "../logging.js"

// These are singletons - can't test without mocking
router.post("/token", async (req,res) => {
  await redis.get(...)  // Direct global usage
  jsonLogger.info(...)
})
```

**Testing requires:**
- Mocking modules (jest.mock, sinon, etc.)
- Running actual Redis instance
- Complex test setup

### Functional: Reader Pattern

```typescript
export const processAuthCodeGrant = (
  grant: AuthCodeGrant
): RTE.ReaderTaskEither<AppEnvironment, AppError, OAuth2TokenResponse> =>
  pipe(
    RTE.ask<AppEnvironment>(),  // Ask for environment
    RTE.chainW((env) => {
      // env.redis, env.logger, env.google available here
    })
  )
```

**Testing:**

```typescript
const testEnv: AppEnvironment = {
  redis: createMockRedis(),
  google: createMockGoogle(),
  logger: createMockLogger(),
  config: testConfig,
}

const result = await processAuthCodeGrant(grant)(testEnv)()
// Pure function - same inputs = same outputs
```

## Performance Considerations

### Parallel Operations

Imperative version runs operations sequentially:

```typescript
const authData = await redis.get(key1)  // Wait
const pkceState = await redis.get(key2)  // Wait
```

Functional version can parallelize:

```typescript
import { sequenceT } from 'fp-ts/Apply'

pipe(
  sequenceT(TE.ApplicativePar)(
    redisOps.getAuthCode(code, codec),
    redisOps.getAuthCodeState(code, codec)
  ),
  // Both run in parallel!
)
```

## Migration Path

You can migrate incrementally:

1. **Side-by-side deployment**
   ```typescript
   app.use('/oauth2', passthroughAuth)        // Old
   app.use('/oauth2/fp', passthroughAuthFp)   // New
   ```

2. **Feature flag**
   ```typescript
   const router = process.env.USE_FP ? fpRouter : imperativeRouter
   app.use('/oauth2', router)
   ```

3. **Gradual route migration**
   - Start with `/token` endpoint (done!)
   - Move `/callback` next
   - Then `/login`, `/consent`, etc.

## Summary

| Aspect | Imperative | Functional |
|--------|-----------|-----------|
| **Side effects** | Mixed with logic | Wrapped in TaskEither |
| **Error handling** | try/catch/.catch() | Either/TaskEither |
| **Type safety** | Runtime only | Compile + runtime (io-ts) |
| **Dependencies** | Global imports | Injected via Reader |
| **Testing** | Mock globals | Inject test environment |
| **Control flow** | if/else/return | pipe + chain |
| **Errors** | Exceptions | Values (ADTs) |
| **Composability** | Low | High |
| **Lines of code** | 166 | ~200 (more explicit) |
| **Bug surface** | High | Low |

## Next Steps

1. Run existing tests against functional endpoint
2. Add property-based tests with fast-check
3. Migrate other routes using the same pattern
4. Consider adding Effect-TS for more advanced patterns
5. Benchmark performance (functional often faster due to lazy evaluation)

## Resources

- [fp-ts documentation](https://gcanti.github.io/fp-ts/)
- [io-ts documentation](https://gcanti.github.io/io-ts/)
- [Railway-Oriented Programming](https://fsharpforfunandprofit.com/rop/)
- [Functional Design Patterns](https://www.youtube.com/watch?v=E8I19uA-wGY)
