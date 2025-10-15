# Prepare local machine for Ory/hydra development

brew tap ory/tap
brew install ory-hydra
Commands should be run for root of the clone

## Generate a new client for your local docker environment

`bash +x build/oauth2-client-meta.sh authClient`

JSON output of the response data, and AUTH_FLOW_CLIENT_ID is written to `.env.auth.hydra`
There is no client secret as this is for a public key exchange, were secrets are not possible.

`bash +x build./oauth2-client-meta.sh createEnvFile [hostname] [cookie-domain]`

for local development, use
`bash +x build./oauth2-client-meta.sh createEnvFile dev.bondlink.org bondlink.org`
