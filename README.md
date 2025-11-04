# Hydra-headless-ts

A hydra middleware client, based on the great information in hydra-consent-node.
Currently Google middleware is implemented. This application will handle the DCR OAuth2 Flows,
currently from Claude.ai. Though the client should not matter. The limitation is currently the types
of flows supported.

## Localhost vs Proxy

The code is written to run behind a proxy, or directly. It was developed behind HAProxy -> Nginx -> App.

Nginx and HAProxy configs to be provided
