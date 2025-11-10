#!/usr/bin/env bash
###########################
### DEPRECATED.  USE npm cli -- list-clients, get-client <client_id> or new-client <client_name>
###########################
set -e
OPERATION=$1
shift
COOKIE_DOMAIN="domain.tld"
HOST_IP=
ISSUER=
ISSUER_ADMIN=
CALLBACK_HOST=
POSTGRES_PASSWORD="my-super-secret-password"
ENV_PATH=/etc/hydra-headless-ts
HYDRA_AUTH_FILE="${ENV_PATH}/.env.auth.hydra"
HYDRA_CODE_FILE="${ENV_PATH}/.env.code.hydra"
GOOGLE_AUTH_FILE="${ENV_PATH}/.env.auth.google"

[ ! -f "${HYDRA_AUTH_FILE}" ] && touch "${HYDRA_AUTH_FILE}"
[ ! -f "${HYDRA_CODE_FILE}" ] && touch "${HYDRA_CODE_FILE}"

# This script creates an OAuth2 client in Hydra and generates a .env file for the consent app.
#TODO Add prod
if [ "$(uname)" = "Darwin" ]; then
  SERVER_NAME="dev.${COOKIE_DOMAIN}"
  HOST_IP=$(ipconfig getifaddr en0)
  ISSUER="http://${SERVER_NAME}:4444"
  ISSUER_ADMIN="http://${HOST_IP}:4445"
  CALLBACK_HOST="http://${SERVER_NAME}:3000"
elif [[ "$(hostname)" == "staging"* ]]; then
  SERVER_NAME="auth.staging.${COOKIE_DOMAIN}"
  HOST_IP=$(hostname -I | cut -d ' ' -f1)
  ISSUER_ADMIN="http://${HOST_IP}:4445"
  CALLBACK_HOST="https://auth.staging.${COOKIE_DOMAIN}"
  ISSUER="https://${SERVER_NAME}"
fi

declare -A CLIENT_CREDENTIALS_CONFIG
CLIENT_CREDENTIALS_CONFIG[scope]="offline email openid offline_access"
CLIENT_CREDENTIALS_CONFIG[grant]="client_secret_post"

declare -A AUTH_FLOW_CONFIG
AUTH_FLOW_CONFIG[scope]="offline openid"
AUTH_FLOW_CONFIG[grant]="authorization_code,refresh_token"
AUTH_FLOW_CONFIG[response-type]="code,id_token"
AUTH_FLOW_CONFIG[token-endpoint-auth-method]="none"


AUTH_FLOW_CLIENT_ID=$(grep AUTH_FLOW_CLIENT_ID ${HYDRA_AUTH_FILE} | cut -d '=' -f2 2>/dev/null) || ""
CODE_CLIENT_ID=$(grep CODE_CLIENT_ID ${HYDRA_CODE_FILE} | cut -d '=' -f2 2>/dev/null) || ""

authClient() {
  if [ -n "${AUTH_FLOW_CLIENT_ID}" ]; then
    echo "Client ID already exists in .env file: $AUTH_FLOW_CLIENT_ID"
    echo "Skipping client creation."
    return
  fi

  client_output=$(hydra create client --endpoint "${ISSUER_ADMIN}" \
    --grant-type "authorization_code,refresh_token" \
    --response-type "code,id_token" \
    --format json \
    --token-endpoint-auth-method none \
    --scope "openid,email,profile,offline_access" \
    --redirect-uri "${CALLBACK_HOST}/callback" \
    --format json
  )
  validateResponse "${client_output}"
  client_id=$(echo $client_output | jq -r '.client_id')
  client_secret=$(echo $client_output | jq -r '.client_secret')
  echo "AUTH_FLOW_CLIENT_ID=$client_id" | tee .env.auth.hydra
  echo "AUTH_FLOW_CLIENT_SECRET=$client_secret" | tee -a .env.auth.hydra
  echo "$client_output"
}


validateResponse() {
  local client_data="${1}"
  client_id=$(echo "$client_data" | jq -r '.client_id')
  client_secret=$(echo "$client_data" | jq -r '.client_secret')
  if [ -z "$client_id" ] || [ -z "$client_secret" ]; then
    echo "Failed to create OAuth2 client. Output was:"
    echo "$client_data"
    exit 1
  fi
  echo "${client_id} ${client_secret}"
}

codeClient() {
  if [ -n "$CODE_CLIENT_ID" ]; then
    echo "Client ID already exists in .env file: $CODE_CLIENT_ID"
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

  validateResponse "${client_output}"

  client_id=$(echo "$client_output" | jq -r '.client_id')
  client_secret=$(echo "$client_output" | jq -r '.client_secret')
  echo "AUTH_FLOW_CLIENT_ID=$code_client_id" | tee .env.code.hydra
  echo "AUTH_FLOW_CLIENT_SECRET=$code_client_secret" | tee -a .env.code.hydra
  echo "${client_output}"
}

# Delete/redo this
updateClient() {
  if [ -z "$AUTH_FLOW_CLIENT_ID" ]; then
    echo "CLIENT_ID is not set in .env file. Cannot update client."
    exit 1
  fi
  client_output=$(hydra update client $AUTH_FLOW_CLIENT_ID --endpoint "${ISSUER_ADMIN}" \
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
  # _validateClientId
  hydra get oauth2-client $CODE_CLIENT_ID --endpoint "${ISSUER_ADMIN}" --format json | jq '.'
  # _validateAuthClientId
  hydra get oauth2-client $AUTH_FLOW_CLIENT_ID --endpoint "${ISSUER_ADMIN}" --format json | jq '.'
}

createEnvFile() {
  cat <<-EOF > /etc/hydra-headless-ts/.env
HYDRA_ADMIN_URL=${ISSUER_ADMIN}
HYDRA_URL=${ISSUER}
POSTGRES_HOST=${HOST_IP}
BASE_URL=${CALLBACK_HOST}
URLS_SELF_ISSUER=${ISSUER}
URLS_CONSENT=${CALLBACK_HOST}/consent
URLS_LOGIN=${CALLBACK_HOST}/login
BASE_URL=${CALLBACK_HOST}
REDIRECT_URL=${CALLBACK_HOST}/callback
NODE_ENV=development
SERVE_COOKIES_DOMAIN=domain.tld
SERVE_PUBLIC_CORS_ENABLED=false
SERVE_ADMIN_CORS_ENABLED=false
SERVE_PUBLIC_CORS_ALLOWED_ORIGINS="*"
SERVE_ADMIN_CORS_ALLOWED_ORIGINS="*"
DSN=postgres://hydra:${POSTGRES_PASSWORD}@postgres:5432/hydra?sslmode=disable
SERVE_PUBLIC_CORS_ALLOWED_METHODS=POST,GET,PUT,DELETE
SERVE_ADMIN_CORS_ALLOWED_METHODS=POST,GET,PUT,DELETE
OAUTH2_EXPOSE_INTERNAL_ERRORS=true
LOG_LEAK_SENSITIVE_VALUES=true
LOG_LEVEL=info
LOG_FORMAT=json
EOF
}

$OPERATION "$@"
