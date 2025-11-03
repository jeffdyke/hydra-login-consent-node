# Tomorrow

1 Continue to test pkce values in redis
2 reach out to Justin once you have a split between oauth2 logic and better javascript
3 start passing all of the pkce values from redis rather than worrying about sessions
    3a: sessions are still created and written to, and req.session.pkceKey is a single point of failure.

- Determine how to get to the next step where the app is the codeVerifier and hydra has no care
    other than a direct string match.

- /oauth2/token will also need to be proxied as hydra no longer has a concept of PKCE
  - We validate and tell Hydra its good.


  Good Day:
  Headed to the Celtics with a friend
    Multiple train delays, yet only arrived ~5m in
    in a rush across the tunnel, guy looking for cash and i a bit, backed up and added to his cup.





-------------- The last commit has mismatches to redis key sets and gets, should always be the session.id...i think
