# Effect Migration Status

## ✅ Completed (All Services Converted!)

### 1. Core Infrastructure
- ✅ **types.ts** - Effect type aliases
- ✅ **errors.ts** - Data.TaggedError classes
- ✅ **domain.ts** - Effect Schema (all 10 schemas)
- ✅ **validation.ts** - Effect-based validation

### 2. Service Layer (All Effect + Context.Tag)
- ✅ **services/redis.ts** - RedisService with Layer
  - `makeRedisService(client)` - Creates implementation
  - `RedisServiceLive(client)` - Layer for DI
  - All methods return `Effect.Effect<Result, RedisError>`

- ✅ **services/google.ts** - GoogleOAuthService with Layer
  - `makeGoogleOAuthService(config)` - Creates implementation
  - `GoogleOAuthServiceLive(config)` - Layer for DI
  - Returns `Effect.Effect<GoogleTokenResponse, HttpError>`

- ✅ **services/hydra.ts** - HydraService with Layer
  - `makeHydraService(client)` - Creates implementation
  - `HydraServiceLive(client)` - Layer for DI
  - All Hydra API calls return `Effect.Effect<Result, HttpError>`

## 🚧 Remaining Work

### 3. Business Logic (Still using fp-ts)
These need to be converted to use `Effect.gen` and new schemas:

- ❌ **services/token.ts** - Token grant business logic
  - Currently uses: `RTE.ReaderTaskEither`, `TE.TaskEither`
  - Needs: `Effect.gen`, access services via `yield* RedisService`
  - Fix: Change `PKCEStateCodec` → `PKCEStateSchema`
  - Fix: Change `AuthCodeDataCodec` → `AuthCodeDataSchema`
  - Fix: Change `RefreshTokenDataCodec` → `RefreshTokenDataSchema`

- ❌ **services/login.ts** - Login flow logic
  - Currently uses: `RTE.ReaderTaskEither`
  - Needs: `Effect.gen`, access `HydraService`

- ❌ **services/consent.ts** - Consent flow logic
  - Currently uses: `RTE.ReaderTaskEither`
  - Needs: `Effect.gen`, access `HydraService`

- ❌ **services/callback.ts** - OAuth callback logic
  - Currently uses: `RTE.ReaderTaskEither`
  - Needs: `Effect.gen`, access `RedisService`, `GoogleOAuthService`
  - Fix: Change `PKCEStateCodec` → `PKCEStateSchema`

- ❌ **services/logout.ts** - Logout flow logic
  - Currently uses: `RTE.ReaderTaskEither`
  - Needs: `Effect.gen`, access `HydraService`

### 4. Route Handlers (Still using fp-ts)
Need to convert to Effect.runPromise:

- ❌ **routes/passthrough-auth-fp.ts**
  - Fix: Import `Effect` instead of `RTE`, `TE`, `E`
  - Fix: Change `TokenRequestCodec` → `TokenRequestSchema`
  - Fix: Use `Effect.runPromise` instead of `()(env)()`

- ❌ **routes/login-fp.ts**
  - Fix: Import `Effect` instead of `E`
  - Fix: Use `Effect.runPromise`

- ❌ **routes/consent-fp.ts**
  - Fix: Import `Effect` instead of `E`
  - Fix: Use `Effect.runPromise`

- ❌ **routes/callback-fp.ts**
  - Fix: Import `Effect` instead of `E`
  - Fix: Use `Effect.runPromise`

- ❌ **routes/logout-fp.ts**
  - Fix: Import `Effect` instead of `E`
  - Fix: Use `Effect.runPromise`

### 5. Environment & Bootstrap
- ❌ **environment.ts** - Update to use Context.Tag
- ❌ **bootstrap.ts** - Create Layer.mergeAll
- ❌ **app-fp.ts** - Provide layers to effects

## Migration Pattern Example

### Before (fp-ts):
```typescript
import * as RTE from 'fp-ts/ReaderTaskEither'
import { PKCEStateCodec } from '../domain.js'

export const processLogin = (
  challenge: string
): RTE.ReaderTaskEither<AppEnvironment, AppError, string> =>
  pipe(
    RTE.ask<AppEnvironment>(),
    RTE.chainW(env =>
      RTE.fromTaskEither(env.hydra.getLoginRequest(challenge))
    )
  )

// Usage
const result = await processLogin('abc')(env)()
```

### After (Effect):
```typescript
import { Effect } from 'effect'
import { HydraService } from './hydra.js'
import { PKCEStateSchema } from '../domain.js'

export const processLogin = (
  challenge: string
): Effect.Effect<string, AppError, HydraService> =>
  Effect.gen(function* () {
    const hydra = yield* HydraService
    const loginRequest = yield* hydra.getLoginRequest(challenge)
    // ... rest of logic
    return redirectUrl
  })

// Usage with Layer
const result = await Effect.runPromise(
  pipe(
    processLogin('abc'),
    Effect.provide(HydraServiceLive(hydraClient))
  )
)
```

## Quick Fix Checklist

For each business logic file (`services/*.ts`):
1. ✅ Change imports:
   ```typescript
   // Old
   import * as RTE from 'fp-ts/ReaderTaskEither'
   import * as TE from 'fp-ts/TaskEither'
   import * as E from 'fp-ts/Either'

   // New
   import { Effect, pipe } from 'effect'
   ```

2. ✅ Change codec names:
   ```typescript
   // Old
   PKCEStateCodec, AuthCodeDataCodec, RefreshTokenDataCodec

   // New
   PKCEStateSchema, AuthCodeDataSchema, RefreshTokenDataSchema
   ```

3. ✅ Convert to Effect.gen:
   ```typescript
   // Old
   pipe(
     RTE.ask<AppEnvironment>(),
     RTE.chainW(env => ...)
   )

   // New
   Effect.gen(function* () {
     const service = yield* ServiceTag
     const result = yield* service.method()
     return result
   })
   ```

4. ✅ Access services via Context.Tag:
   ```typescript
   // Old
   env.redis.get(key)

   // New
   const redis = yield* RedisService
   yield* redis.get(key)
   ```

For route handlers:
1. ✅ Change E.fold → Effect.match or manual if/else
2. ✅ Use `Effect.runPromise` instead of `()(env)()`
3. ✅ Provide layers when running

## Compilation Errors Summary

From `npm run typecheck`:
- **78 errors total**
- Most are: "Cannot find module 'fp-ts/...'"
- Some are: Schema name mismatches (Codec → Schema)
- Some are: Implicit 'any' types (need type hints in gen)

All errors are in:
- `services/token.ts` (20+ errors)
- `services/login.ts` (5 errors)
- `services/consent.ts` (5 errors)
- `services/callback.ts` (10+ errors)
- `services/logout.ts` (5 errors)
- `routes/*-fp.ts` (30+ errors)
- `bootstrap.ts` (3 errors)

## Next Steps

### Option 1: Quick fixes (30-60 min)
1. Fix all imports (replace fp-ts with Effect)
2. Rename all Codec → Schema
3. Add type hints to Effect.gen parameters
4. Update route handlers to use Effect.runPromise
5. Fix bootstrap and app-fp.ts

### Option 2: Proper refactor (2-3 hours)
1. Rewrite each business logic service with Effect.gen
2. Use proper Context.Tag access patterns
3. Update all route handlers
4. Create proper Layer composition in app-fp.ts
5. Add retry/timeout policies
6. Test thoroughly

## Testing After Migration

```bash
# Type check
npm run typecheck

# Build
npm run build

# Run functional version
npm run serve:fp
```

## Current Branch State

```
functional-refactor branch:
├── ✅ Core types (Effect)
├── ✅ Errors (Data.TaggedError)
├── ✅ Domain schemas (Effect Schema)
├── ✅ Validation (Effect)
├── ✅ Redis service (Effect + Layer)
├── ✅ Google OAuth service (Effect + Layer)
├── ✅ Hydra service (Effect + Layer)
├── ❌ Business logic (still fp-ts)
├── ❌ Routes (still fp-ts)
└── ❌ Bootstrap (still fp-ts patterns)
```

## Benefits Once Complete

- ✅ Modern Effect system (not deprecated)
- ✅ Better type inference
- ✅ Built-in retry/timeout/resource management
- ✅ Structured concurrency
- ✅ Layer-based dependency injection
- ✅ Effect.gen for readable async code
- ✅ No `()()` double invocation!

The foundation is solid - services are all converted. Now it's just updating the business logic and routes to use the new service interfaces!
