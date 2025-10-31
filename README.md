# hydra-user-and-consent-provider-node

This is based on the reference implementation of [hydra-consent-node](https://github.com/ory/hydra-login-consent-node)

Hydra is used for the start of the OAuth handshake until `/callback`.

Also `/oauth2/auth` is proxied through the application, to avoid altering any portion of the OAuth2 flow.
The login flow is headless, as is the consent. Both are registered in Hydra.

When it hits the `/callback` endpoint, further PKCE validation as well as the `/oauth2/token`
endpoint for both `grant_type == authorization_code` && `grant_type == refresh_token`
are handled by the application.

... this is a work in progress for all other documentation on the implementation project see https://github.com/ory/hydra-login-consent-node
and thank you to the authors.
