# Hydra-headless-ts

A hydra middleware client, based on the great information in hydra-consent-node.
Currently Google middleware is implemented. This application will handle the DCR OAuth2 Flows,
currently from Claude.ai. Though the client should not matter. The limitation is currently the types
of flows supported.

## Localhost vs Proxy

The code is written to run behind a proxy, or directly. It was developed behind HAProxy -> Nginx -> App.
Local development does not enable https

## Development Helpers

- [Dev Overview of Repository](./DEVELOPMENT.md)
- [Linting](./LINTING.md)
- [Quality Baseline](./QUALITY_BASELINE.mc)
- [Unit Tests](./README.test.md)
- [Authorization Flow](AUTH_FLOW.md)
  - This ties nuances of the OAuth2 Authorization Flow into decisions made in the application, as a particular flow was required

### Running Locally

To run this locally,

Simply change into the root of the repository:

- Update LocalDev settings, see [local.env](src/env/local.env)
- Run only watching compile errors `npm run tswatch`
- Launch the application `npm run build && npm run serve:local`

## Installing Docker Environment

TODO....
Nginx and HAProxy configs to be provided
