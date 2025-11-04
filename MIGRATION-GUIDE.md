# OAuth2 API Migration Guide

This guide explains the new Effect-based OAuth2 API implementation and how to migrate from the @ory/client-fetch package.

## What Changed?

A new local OAuth2 API implementation has been added in [src/api/oauth2.ts](src/api/oauth2.ts) that:

1. **Uses Effect instead of Promises** for better error handling
2. **Wraps all OAuth2Api methods** from @ory/client-fetch
3. **Provides explicit error types** in the return signature
4. **Enables functional composition** with pipe, flatMap, etc.
5. **Supports dependency injection** via Effect Context/Layer

## File Structure

```
src/
├── api/
│   ├── oauth2.ts           # New Effect-based OAuth2 API
│   ├── oauth2-example.ts   # Usage examples
│   └── README.md           # Comprehensive API documentation
├── setup/
│   └── hydra.ts            # Updated with both legacy and new API exports
└── fp/
    └── services/
        └── hydra.ts        # Existing Effect-based service (subset of operations)
```

## Quick Start

### Option 1: Use the Service Directly

```typescript
import { oauth2ApiService } from './setup/hydra.js'
import { Effect, pipe } from 'effect'

const program = pipe(
  oauth2ApiService.getLoginRequest(loginChallenge),
  Effect.map(req => req.subject)
)

const result = await Effect.runPromise(program)
```

### Option 2: Use with Dependency Injection

```typescript
import { OAuth2ApiService } from './api/oauth2.js'
import { OAuth2ApiLayer } from './setup/hydra.js'
import { Effect, pipe } from 'effect'

const program = pipe(
  OAuth2ApiService,
  Effect.flatMap(api => api.getLoginRequest(loginChallenge))
)

const result = await Effect.runPromise(
  Effect.provide(program, OAuth2ApiLayer)
)
```

## Migration Examples

### Example 1: Simple GET Request

**Before (Promise-based):**
```typescript
import hydraAdmin from './setup/hydra.js'

try {
  const loginRequest = await hydraAdmin.getOAuth2LoginRequest({
    loginChallenge: challenge
  })
  return loginRequest.subject
} catch (error) {
  console.error('Failed:', error)
  return null
}
```

**After (Effect-based):**
```typescript
import { oauth2ApiService } from './setup/hydra.js'
import { Effect, pipe } from 'effect'

const program = pipe(
  oauth2ApiService.getLoginRequest(challenge),
  Effect.map(req => req.subject),
  Effect.catchAll(error => {
    console.error('Failed:', error)
    return Effect.succeed(null)
  })
)

const result = await Effect.runPromise(program)
```

### Example 2: Sequential Operations

**Before (Promise-based):**
```typescript
import hydraAdmin from './setup/hydra.js'

try {
  const loginReq = await hydraAdmin.getOAuth2LoginRequest({
    loginChallenge: loginChallenge
  })

  const redirect = await hydraAdmin.acceptOAuth2LoginRequest({
    loginChallenge: loginChallenge,
    acceptOAuth2LoginRequest: {
      subject: loginReq.subject || 'user-123'
    }
  })

  return redirect.redirect_to
} catch (error) {
  console.error('Flow failed:', error)
  throw error
}
```

**After (Effect-based):**
```typescript
import { oauth2ApiService } from './setup/hydra.js'
import { Effect, pipe } from 'effect'

const program = pipe(
  oauth2ApiService.getLoginRequest(loginChallenge),
  Effect.flatMap(loginReq =>
    oauth2ApiService.acceptLoginRequest(loginChallenge, {
      subject: loginReq.subject || 'user-123'
    })
  ),
  Effect.map(redirect => redirect.redirect_to)
)

const result = await Effect.runPromise(program)
```

### Example 3: Error Handling by Type

**Before (Promise-based):**
```typescript
try {
  const client = await hydraAdmin.getOAuth2Client({ id: clientId })
  return client
} catch (error: any) {
  if (error.response?.status === 404) {
    return null
  }
  if (error.code === 'ECONNREFUSED') {
    console.error('Cannot connect to Hydra')
    throw new Error('Service unavailable')
  }
  throw error
}
```

**After (Effect-based):**
```typescript
import { oauth2ApiService } from './setup/hydra.js'
import { Effect, pipe } from 'effect'

const program = pipe(
  oauth2ApiService.getClient(clientId),
  Effect.catchTag('HttpStatusError', error => {
    if (error.status === 404) {
      return Effect.succeed(null)
    }
    return Effect.fail(error)
  }),
  Effect.catchTag('NetworkError', error => {
    console.error('Cannot connect to Hydra')
    return Effect.fail(new Error('Service unavailable'))
  })
)

const result = await Effect.runPromise(program)
```

### Example 4: Parallel Requests

**Before (Promise-based):**
```typescript
const [client1, client2, client3] = await Promise.all([
  hydraAdmin.getOAuth2Client({ id: 'id1' }),
  hydraAdmin.getOAuth2Client({ id: 'id2' }),
  hydraAdmin.getOAuth2Client({ id: 'id3' })
])
```

**After (Effect-based):**
```typescript
const [client1, client2, client3] = await Effect.runPromise(
  Effect.all([
    oauth2ApiService.getClient('id1'),
    oauth2ApiService.getClient('id2'),
    oauth2ApiService.getClient('id3')
  ], { concurrency: 'unbounded' })
)
```

## Benefits of Effect

### 1. Explicit Error Types

**Promise:**
```typescript
// What errors can this throw? We don't know!
async function getLogin(challenge: string): Promise<OAuth2LoginRequest>
```

**Effect:**
```typescript
// Clear: can fail with HttpError
function getLogin(challenge: string): Effect.Effect<OAuth2LoginRequest, HttpError>
```

### 2. Composability

**Promise (nested callbacks):**
```typescript
try {
  const login = await getLogin(challenge)
  try {
    const redirect = await acceptLogin(challenge, login.subject)
    return redirect.redirect_to
  } catch (e) {
    console.error('Accept failed')
    throw e
  }
} catch (e) {
  console.error('Get failed')
  throw e
}
```

**Effect (pipeline):**
```typescript
pipe(
  getLogin(challenge),
  Effect.flatMap(login => acceptLogin(challenge, login.subject)),
  Effect.map(redirect => redirect.redirect_to),
  Effect.tapError(error => Effect.sync(() => console.error('Failed:', error)))
)
```

### 3. Built-in Retry & Timeout

**Promise (manual retry logic):**
```typescript
async function createClientWithRetry(client: any, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await hydraAdmin.createOAuth2Client({ oAuth2Client: client })
    } catch (error) {
      if (i === retries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
}
```

**Effect (declarative):**
```typescript
pipe(
  oauth2ApiService.createClient(client),
  Effect.retry({ times: 3 }),
  Effect.timeout('10 seconds')
)
```

### 4. Testability

**Promise (requires mocking):**
```typescript
jest.mock('./setup/hydra', () => ({
  default: {
    getOAuth2LoginRequest: jest.fn()
  }
}))
```

**Effect (pure DI):**
```typescript
const mockApi: OAuth2ApiService = {
  getLoginRequest: (challenge) => Effect.succeed(mockData),
  // ... other methods
}

const program = pipe(
  Effect.succeed(mockApi),
  Effect.flatMap(api => api.getLoginRequest('test'))
)
```

## API Coverage

The new OAuth2 API covers **ALL** methods from @ory/client-fetch OAuth2Api:

### Authentication Flow
- ✅ getLoginRequest
- ✅ acceptLoginRequest
- ✅ rejectLoginRequest
- ✅ getConsentRequest
- ✅ acceptConsentRequest
- ✅ rejectConsentRequest
- ✅ getLogoutRequest
- ✅ acceptLogoutRequest
- ✅ rejectLogoutRequest

### Device Flow
- ✅ deviceFlow
- ✅ acceptUserCodeRequest
- ✅ performDeviceVerificationFlow

### Client Management
- ✅ createClient
- ✅ getClient
- ✅ listClients
- ✅ updateClient (PUT)
- ✅ patchClient (PATCH)
- ✅ deleteClient
- ✅ setClientLifespans

### Token Management
- ✅ introspectToken
- ✅ revokeToken
- ✅ deleteTokens
- ✅ tokenExchange

### Session Management
- ✅ listConsentSessions
- ✅ revokeConsentSessions
- ✅ revokeLoginSessions

### JWT Grant Issuers
- ✅ trustJwtGrantIssuer
- ✅ getTrustedJwtGrantIssuer
- ✅ listTrustedJwtGrantIssuers
- ✅ deleteTrustedJwtGrantIssuer

### Other
- ✅ authorize

## Backwards Compatibility

The legacy `@ory/client-fetch` OAuth2Api is still available:

```typescript
import hydraAdmin from './setup/hydra.js'

// Still works!
const loginRequest = await hydraAdmin.getOAuth2LoginRequest({
  loginChallenge: challenge
})
```

You can migrate incrementally, one module at a time.

## Performance

- **Native fetch**: Uses Node.js built-in fetch (requires Node 18+)
- **No SDK overhead**: Direct HTTP calls
- **Connection pooling**: Automatic via fetch
- **Parallel execution**: `Effect.all` with `concurrency: 'unbounded'`

## Type Safety

All types are imported from `@ory/client-fetch`, ensuring compatibility:

```typescript
import type {
  OAuth2LoginRequest,
  OAuth2ConsentRequest,
  OAuth2RedirectTo,
  OAuth2Client,
  // ... all official types
} from '@ory/client-fetch'
```

## Additional Resources

- **API Documentation**: [src/api/README.md](src/api/README.md)
- **Usage Examples**: [src/api/oauth2-example.ts](src/api/oauth2-example.ts)
- **Effect Documentation**: https://effect.website
- **Ory Hydra API**: https://www.ory.sh/docs/hydra/reference/api

## Common Patterns

### Pattern 1: Get-or-Create

```typescript
const getOrCreateClient = (clientId: string, defaultClient: OAuth2Client) =>
  pipe(
    oauth2ApiService.getClient(clientId),
    Effect.catchTag('HttpStatusError', error =>
      error.status === 404
        ? oauth2ApiService.createClient(defaultClient)
        : Effect.fail(error)
    )
  )
```

### Pattern 2: Conditional Flow

```typescript
const handleLogout = (challenge: string, userConfirmed: boolean) =>
  userConfirmed
    ? oauth2ApiService.acceptLogoutRequest(challenge)
    : pipe(
        oauth2ApiService.rejectLogoutRequest(challenge),
        Effect.map(() => ({ redirect_to: '/login' }))
      )
```

### Pattern 3: Validation + Action

```typescript
const introspectAndRevoke = (token: string) =>
  pipe(
    oauth2ApiService.introspectToken(token),
    Effect.filterOrFail(
      data => data.active === true,
      () => new Error('Token already inactive')
    ),
    Effect.flatMap(() => oauth2ApiService.revokeToken(token))
  )
```

## Next Steps

1. **Read the API docs**: [src/api/README.md](src/api/README.md)
2. **Try the examples**: [src/api/oauth2-example.ts](src/api/oauth2-example.ts)
3. **Start migrating**: Pick a simple module and convert it
4. **Learn Effect**: https://effect.website/docs/introduction

## Questions?

- Check [src/api/README.md](src/api/README.md) for detailed API documentation
- Look at [src/api/oauth2-example.ts](src/api/oauth2-example.ts) for real-world examples
- Review [src/fp/services/](src/fp/services/) for similar Effect patterns
