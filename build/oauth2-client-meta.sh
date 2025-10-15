#!/usr/bin/env bash
set -e
OPERATION=$1
shift

# This script creates an OAuth2 client in Hydra and generates a .env file for the consent app.
HOST_IP=$(ipconfig getifaddr en0)
ISSUER="http://${HOST_IP}:4444"
ISSUER_ADMIN="http://${HOST_IP}:4445"
CALLBACK_HOST="http://${HOST_IP}:3000"
APP_SCOPE="offline email openid offline_access"
APP_GRANT_TYPE="client_credentials authorization_code refresh_token"
CLIENT_ID=$(grep CLIENT_ID .env | cut -d '=' -f2 2>/dev/null) || ""
_validateClientId() {
  if [ -n "$CLIENT_ID" ] && ! [[ "$CLIENT_ID" =~ ^[0-9a-fA-F-]{36}$ ]]; then
    echo "CLIENT_ID in .env file is not a valid UUID: $CLIENT_ID"
    exit 1
  fi
}
createClient() {
  if [ -n "$CLIENT_ID" ]; then
    echo "Client ID already exists in .env file: $CLIENT_ID"
    echo "Skipping client creation."
    return
  fi

  client_output=$(hydra create client --endpoint "${ISSUER_ADMIN}" \
  --name "${APP_NAME}" \
  --scope "${APP_SCOPE}" \
  --grant-type "${APP_GRANT_TYPE}" \
  --response-type code \
  --token-endpoint-auth-method none \
  --redirect-uri "${CALLBACK_HOST}/callback" \
  --format json)


  client_id=$(echo "$client_output" | jq -r '.client_id')
  client_secret=$(echo "$client_output" | jq -r '.client_secret')
  if [ -z "$client_id" ] || [ -z "$client_secret" ]; then
    echo "Failed to create OAuth2 client. Output was:"
    echo "$client_output"
    exit 1
  fi

  echo "$client_id"
}

updateClient() {
  if [ -z "$CLIENT_ID" ]; then
    echo "CLIENT_ID is not set in .env file. Cannot update client."
    exit 1
  fi
  client_output=$(hydra update client $CLIENT_ID --endpoint "${ISSUER_ADMIN}" \
  --name "${APP_NAME}" \
  --scope "${APP_SCOPE}" \
  --grant-type "${APP_GRANT_TYPE}" \
  --response-type code \
  --token-endpoint-auth-method none \
  --redirect-uri "${CALLBACK_HOST}/callback" \
  --format json)

  echo "$client_output"
}
getClient() {
  _validateClientId
  hydra get oauth2-client $CLIENT_ID --endpoint "${ISSUER_ADMIN}" --format json | jq '.'
}

createEnvFile() {
  local client_id=$1
  local client_secret=$2
  echo "Client ID: $client_id"
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
  NODE_ENV=development
  SERVE_PUBLIC_CORS_ENABLED=true
  DSN=postgres://hydra:shaken!stirred@${HOST_IP}:5432/hydra?sslmode=disable
EOF
}


$OPERATION "$@"
