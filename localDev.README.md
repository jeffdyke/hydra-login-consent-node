# Prepare local machine for Ory/hydra development

brew tap ory/tap
brew install ory-hydra

## Generate a new client for your local docker environment

```bash
HOST_IP=$(ipconfig getifaddr en0)
ISSUER="http://${HOST_IP}:4445"
CALLBACK_HOST="http://${HOST_IP}:3000"
client_output=$(hydra create client \
  --endpoint "${ISSUER}" \
  --name "ory-hydra-test-application" \
  --scope "offline email openid offline_access" && \
  --grant-type "client_credentials, authorization_code, refresh_token"
  --response-type "code" && \
  --redirect-uri "${CALLBACK_HOST}/callback" \
  --format json)

client_id=$(echo "$client_output" | jq -r '.client_id')
client_secret=$(echo "$client_output" | jq -r '.client_secret')

echo "Client ID: $client_id"
echo "Client Secret: $client_secret"

```
