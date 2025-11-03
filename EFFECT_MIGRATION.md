# Effect Migration from fp-ts

This document outlines the migration from `fp-ts` to `Effect` for better ergonomics and modern functional programming patterns.

## Why Effect?

- **fp-ts is deprecated** - No longer actively developed
- **Better ergonomics** - Cleaner API, better type inference
- **Built-in features** - Retry, timeout, resource management, structured concurrency
- **Active development** - Modern TypeScript features, growing ecosystem
- **Unified schema** - Effect Schema replaces io-ts with better integration

## Migration Status

### ✅ Completed

1. **Core Types** ([src/fp/types.ts](src/fp/types.ts))
   - `TaskEither<E, A>` → `Effect.Effect<A, E>`
   - `ReaderTaskEither<R, E, A>` → `Effect.Effect<A, E, R>`
   - `pipe` from `fp-ts/function` → `pipe` from `effect`

2. **Error Types** ([src/fp/errors.ts](src/fp/errors.ts))
   - Manual ADTs with `_tag` → `Data.TaggedError`
   - Constructor functions → Class-based errors
   - Better stack traces and error messages

3. **Domain Types** ([src/fp/domain.ts](src/fp/domain.ts))
   - `io-ts` codecs → `Effect Schema`
   - `t.type` → `Schema.Struct`
   - `t.union` → `Schema.Union`
   - `t.literal` → `Schema.Literal`

4. **Validation** ([src/fp/validation.ts](src/fp/validation.ts))
   - `E.Either` → `Effect.Effect`
   - `E.left/right` → `Effect.fail/succeed`
   - Schema decoding with proper error handling

### 🚧 In Progress

5. **Services** - Redis, Google OAuth, Hydra need conversion
6. **Business Logic** - Token, Login, Consent, Callback, Logout services
7. **Route Handlers** - Update to use Effect.runPromise
8. **Bootstrap** - Update environment creation

## Key Patterns

### Pattern 1: TaskEither → Effect

**Before (fp-ts):**
```typescript
import * as TE from 'fp-ts/TaskEither'
import { pipe } from 'fp-ts/function'

const operation = (): TE.TaskEither<MyError, Result> =>
  TE.tryCatch(
    () => performAsync(),
    (error) => new MyError(error)
  )

// Usage
const result = await pipe(
  operation(),
  TE.map(x => x + 1),
  TE.chain(x => anotherOperation(x))
)()
```

**After (Effect):**
```typescript
import { Effect, pipe } from 'effect'

const operation = (): Effect.Effect<Result, MyError> =>
  Effect.tryPromise({
    try: () => performAsync(),
    catch: (error) => new MyError({ error })
  })

// Usage
const result = await pipe(
  operation(),
  Effect.map(x => x + 1),
  Effect.flatMap(x => anotherOperation(x)),
  Effect.runPromise
)
```

### Pattern 2: io-ts → Effect Schema

**Before (io-ts):**
```typescript
import * as t from 'io-ts'
import { PathReporter } from 'io-ts/PathReporter'

const UserCodec = t.type({
  name: t.string,
  age: t.number,
  email: t.union([t.string, t.undefined])
})

type User = t.TypeOf<typeof UserCodec>

const validate = (data: unknown): E.Either<ValidationError, User> => {
  const result = UserCodec.decode(data)
  return pipe(
    result,
    E.mapLeft(errors => ({
      _tag: 'ValidationError',
      errors: PathReporter.report(result)
    }))
  )
}
```

**After (Effect Schema):**
```typescript
import { Schema } from 'effect'

const UserSchema = Schema.Struct({
  name: Schema.String,
  age: Schema.Number,
  email: Schema.optional(Schema.String)
})

type User = typeof UserSchema.Type

const validate = (data: unknown): Effect.Effect<User, SchemaValidationError> =>
  pipe(
    Schema.decodeUnknown(UserSchema)(data),
    Effect.mapError(error => new SchemaValidationError({
      errors: ParseResult.ArrayFormatter.formatErrorSync(error)
        .map(e => e.message),
      value: data
    }))
  )
```

### Pattern 3: Error Constructors → Tagged Errors

**Before (fp-ts):**
```typescript
export type MyError =
  | { _tag: 'NetworkError'; message: string }
  | { _tag: 'ParseError'; data: unknown }

export const MyError = {
  network: (message: string): MyError => ({
    _tag: 'NetworkError',
    message
  }),
  parse: (data: unknown): MyError => ({
    _tag: 'ParseError',
    data
  })
}
```

**After (Effect):**
```typescript
import { Data } from 'effect'

export class NetworkError extends Data.TaggedError('NetworkError')<{
  message: string
}> {}

export class ParseError extends Data.TaggedError('ParseError')<{
  data: unknown
}> {}

export type MyError = NetworkError | ParseError

// Usage
Effect.fail(new NetworkError({ message: 'Failed' }))
```

### Pattern 4: ReaderTaskEither → Effect with Context

**Before (fp-ts):**
```typescript
import * as RTE from 'fp-ts/ReaderTaskEither'

interface AppEnvironment {
  redis: RedisService
  logger: Logger
}

const processData = (id: string): RTE.ReaderTaskEither<AppEnvironment, MyError, Result> =>
  pipe(
    RTE.ask<AppEnvironment>(),
    RTE.chainW(env =>
      RTE.fromTaskEither(env.redis.get(id))
    )
  )

// Run with environment
const result = await processData('123')(env)()
```

**After (Effect):**
```typescript
import { Effect, Context } from 'effect'

class RedisService extends Context.Tag('RedisService')<
  RedisService,
  { get: (id: string) => Effect.Effect<string, RedisError> }
>() {}

class Logger extends Context.Tag('Logger')<
  Logger,
  { info: (msg: string) => Effect.Effect<void> }
>() {}

const processData = (id: string): Effect.Effect<Result, MyError, RedisService | Logger> =>
  Effect.gen(function* () {
    const redis = yield* RedisService
    const logger = yield* Logger

    const data = yield* redis.get(id)
    yield* logger.info(`Fetched ${id}`)

    return data
  })

// Provide services
const result = await pipe(
  processData('123'),
  Effect.provideService(RedisService, redisImpl),
  Effect.provideService(Logger, loggerImpl),
  Effect.runPromise
)
```

### Pattern 5: Chaining Operations

**Before (fp-ts):**
```typescript
pipe(
  TE.Do,
  TE.bindW('user', () => fetchUser(id)),
  TE.bindW('posts', ({ user }) => fetchPosts(user.id)),
  TE.map(({ user, posts }) => ({ ...user, posts }))
)
```

**After (Effect):**
```typescript
Effect.gen(function* () {
  const user = yield* fetchUser(id)
  const posts = yield* fetchPosts(user.id)
  return { ...user, posts }
})

// Or with pipe
pipe(
  fetchUser(id),
  Effect.flatMap(user =>
    pipe(
      fetchPosts(user.id),
      Effect.map(posts => ({ ...user, posts }))
    )
  )
)
```

## Benefits of Effect

### 1. Better Error Handling

```typescript
// Automatic retry with exponential backoff
pipe(
  riskyOperation(),
  Effect.retry({ times: 3, schedule: Schedule.exponential('100 millis') })
)

// Timeout
pipe(
  slowOperation(),
  Effect.timeout('5 seconds')
)

// Fallback
pipe(
  operation(),
  Effect.catchAll(error => fallbackOperation())
)
```

### 2. Resource Management

```typescript
// Automatic cleanup
const useDatabase = Effect.acquireRelease(
  openConnection(),
  connection => closeConnection(connection)
)

pipe(
  useDatabase,
  Effect.flatMap(conn => queryDatabase(conn))
)
// Connection automatically closed even on error
```

### 3. Structured Concurrency

```typescript
// Run effects in parallel
Effect.all([
  fetchUser(id),
  fetchPosts(id),
  fetchComments(id)
], { concurrency: 'unbounded' })

// Race multiple effects
Effect.race(
  fetchFromPrimary(),
  pipe(
    Effect.sleep('1 second'),
    Effect.flatMap(() => fetchFromSecondary())
  )
)
```

### 4. Better Type Inference

```typescript
// Effect has better type inference
const program = Effect.gen(function* () {
  const x = yield* Effect.succeed(42)        // number
  const y = yield* Effect.succeed('hello')   // string
  return x + y.length                        // TypeScript knows the types!
})
```

## Conversion Checklist

### Services

- [ ] Convert Redis service to use Effect
- [ ] Convert Google OAuth service to use Effect
- [ ] Convert Hydra service to use Effect
- [ ] Update service interfaces to return Effect

### Business Logic

- [ ] Convert token service (authorization_code + refresh_token)
- [ ] Convert login service
- [ ] Convert consent service
- [ ] Convert callback service
- [ ] Convert logout service

### Route Handlers

- [ ] Update passthrough-auth-fp.ts
- [ ] Update login-fp.ts
- [ ] Update consent-fp.ts
- [ ] Update callback-fp.ts
- [ ] Update logout-fp.ts
- [ ] Replace `()()` with `Effect.runPromise`

### Environment

- [ ] Convert bootstrap to use Effect Context
- [ ] Create service implementations
- [ ] Update app-fp.ts to provide services

## Running the Application

After migration:

```bash
# Build
npm run build

# Run with Effect
npm run serve:fp
```

## Testing

Effect provides better testing utilities:

```typescript
import { Effect, Layer, TestContext } from 'effect'

const testEnv = Layer.succeed(
  RedisService,
  {
    get: (key) => Effect.succeed('test-value'),
    set: (key, value) => Effect.succeed('OK')
  }
)

const test = pipe(
  myProgram(),
  Effect.provide(testEnv),
  Effect.runPromise
)
```

## Resources

- [Effect Documentation](https://effect.website/)
- [Effect Schema](https://effect.website/docs/schema/introduction)
- [Migration from fp-ts](https://effect.website/docs/guides/migration/fp-ts)
- [Effect Discord Community](https://discord.gg/effect-ts)

## Next Steps

1. Complete service conversions
2. Update business logic with Effect.gen
3. Convert route handlers to use Effect.runPromise
4. Add retry and timeout policies
5. Implement resource management for Redis/HTTP connections
6. Add structured logging with Effect's Logger
7. Write tests using Effect test utilities
