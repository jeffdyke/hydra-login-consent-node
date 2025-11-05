# Overview

This service implements a **headless OAuth2 login/consent provider** that bridges Ory Hydra (OAuth2 server with DCR) and Google OAuth (identity provider without DCR support).

[Detailed breakdown of this OAuth2 flow](OAUTH2_ARCHITECTURE.md)

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

- sudo docker compose up -d --build

Nginx and HAProxy configs to be provided


### Nginx Configuration
