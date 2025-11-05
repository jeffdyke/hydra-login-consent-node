import Html from '@kitajs/html'
import { Layout } from './components/Layout.js'

export interface ConsentProps {
  action: string
  envXsrfToken: string
  csrfToken: string
  challenge: string
  requestedScope?: string[]
  client?: {
    client_name?: string
    policy_uri?: string
    tos_uri?: string
  }
}

export function Consent({
  action,
  envXsrfToken,
  csrfToken,
  challenge,
  requestedScope = [],
  client,
}: ConsentProps): string {
  return Layout({
    title: 'Authorize Application',
    children: (
      <>
        <h1>Authorize {client?.client_name ?? 'Application'}</h1>
        <p>
          Hi there! The application <strong>{client?.client_name ?? 'Unknown'}</strong> wants
          access to your data. The following permissions are requested:
        </p>

        {requestedScope.length > 0 && (
          <ul id="scopes">
            {requestedScope.map((scope) => (
              <li>{scope}</li>
            ))}
          </ul>
        )}

        <p>Do you want to grant these permissions?</p>

        <form action={action} method="POST">
          <input type="hidden" name={envXsrfToken} value={csrfToken} />
          <input type="hidden" name="challenge" value={challenge} />

          <input type="checkbox" id="remember" name="remember" value="1" />
          <label for="remember">Remember this decision</label>
          <br />

          <input type="submit" id="accept" name="submit" value="Allow access" />
          <input type="submit" id="reject" name="submit" value="Deny access" />
        </form>

        {client?.policy_uri && (
          <p>
            <a href={client.policy_uri}>Privacy Policy</a>
          </p>
        )}
        {client?.tos_uri && (
          <p>
            <a href={client.tos_uri}>Terms of Service</a>
          </p>
        )}
      </>
    ),
  })
}
