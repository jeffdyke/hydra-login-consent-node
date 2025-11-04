# Test Suite

This project includes a comprehensive baseline test suite covering all Effect-based FP services and configurations.

## Running Tests

```bash
# Run all tests once
npm test

# Watch mode for development
npm run test:watch

# Coverage report
npm run test:coverage

# UI mode (interactive)
npm run test:ui
```

## Test Files

- `src/fp/config.test.ts` - Configuration service tests (AppConfig, environment handling)
- `src/fp/domain.test.ts` - Schema validation tests (PKCE, OAuth2, Google types)
- `src/fp/services/redis.test.ts` - Redis service tests
- `src/fp/services/hydra.test.ts` - Hydra OAuth2 API service tests
- `src/fp/services/google.test.ts` - Google OAuth service tests
- `src/fp/bootstrap.test.ts` - Layer composition and integration tests

## Coverage

Tests cover:
- Effect Config validation and defaults
- Schema validation with Effect Schema
- Service layer composition
- Error handling (HttpError, RedisError, GoogleAuthError)
- Integration between services

## Test Structure

All tests follow Effect patterns:
- Use `Effect.runPromise` for async execution
- Test both success and error paths
- Verify proper error types
- Test layer composition

## Writing New Tests

When adding new services, follow these patterns:

1. **Mock external dependencies** (Redis, HTTP clients, etc.)
2. **Test Effect-based functions** using `Effect.runPromise` and `Effect.either`
3. **Test service layers** using `Effect.provide`
4. **Verify error types** using instanceof checks

Example:
```typescript
it('should handle service errors', async () => {
  const program = service.operation()
  const result = await Effect.runPromise(Effect.either(program))

  expect(result._tag).toBe('Left')
  if (result._tag === 'Left') {
    expect(result.left).toBeInstanceOf(ExpectedError)
  }
})
```
