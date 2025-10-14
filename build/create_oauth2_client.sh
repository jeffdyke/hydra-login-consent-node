#!/usr/bin/env bash
set -xe
# This script creates an OAuth2 client in Hydra and generates a .env file for the consent app.
HOST_IP=$(ipconfig getifaddr en0)
ISSUER="http://${HOST_IP}:4444"
ISSUER_ADMIN="http://${HOST_IP}:4445"
CALLBACK_HOST="http://${HOST_IP}:3000"

client_output=$(hydra create client \
  --endpoint "${ISSUER_ADMIN}" \
  --name "ory-hydra-test-application" \
  --scope "offline email openid offline_access" \
  --grant-type "client_credentials authorization_code refresh_token" \
  --response-type "code" \
  --redirect-uri "${CALLBACK_HOST}/callback" \
  --format json
  )

# hydra create client
#   --endpoint http://$(ipconfig getifaddr en0):4445
#   --token-endpoint-auth-method none
#   --scope "offline email openid offline_access"
#   --grant-type "client_credentials, authorization_code, refresh_token"
#   --redirect-uri "http://$(ipconfig getifaddr en0):3000/callback"
# hydra get oauth2-client 2ace26a5-8e89-4cb3-8360-095c4a26e8b1 --endpoint http://0.0.0.0:4445 --format json | jq '.'
client_id=$(echo "$client_output" | jq -r '.client_id')
client_secret=$(echo "$client_output" | jq -r '.client_secret')

echo "Client ID: $client_id"
echo "Client Secret: $client_secret"
echo "Creating .env file"

cat <<EOF > .env
CLIENT_ID=$client_id
CLIENT_SECRET=$client_secret
POSTGRES_PASSWORD=shaken!stirred
HYDRA_ADMIN_URL=${ISSUER_ADMIN}
HYDRA_URL=${ISSUER}
URLS_SELF_ISSUER=${ISSUER}
URLS_CONSENT=${CALLBACK_HOST}/consent
URLS_LOGIN=${CALLBACK_HOST}/login
BASE_URL=${CALLBACK_HOST}
REDIRECT_URL=${CALLBACK_HOST}/callback
EOF
