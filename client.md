AuthFlow


Steps for Authorization

- [x] Intercept /oauth2/auth and save code_challenge and code_challenge_method
      - Done with http-proxy-middleware, logic in setup/proxy.ts
- [x] Remove capture of variables from referrer in consent.ts

Claude =>
 - intercept /oauth2/auth
   - done wit
  - need to use a client that is NOT PKCE
  - PKCE should only be evauluated by the middleware, hydra should not know
- /login is automatic after /auth is called, and works correctly
- consent is called, i intercept the request and make the two calls for consent endpoints
- hydra calls /callback
 - use a different client with code_credentials to call
Hydra:/oauth2/token => App:login =>
