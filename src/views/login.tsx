import Html from '@kitajs/html'
import { Layout } from './components/Layout.js'

export interface LoginProps {
  action: string
  envXsrfToken: string
  csrfToken: string
  challenge: string
  hint?: string
  error?: string
}

export function Login({
  action,
  envXsrfToken,
  csrfToken,
  challenge,
  hint = '',
  error,
}: LoginProps): string {
  return Layout({
    title: 'Login',
    children: (
      <>
        <h1 id="login-title">Please log in</h1>
        {error && <p>{error}</p>}
        <form action={action} method="POST">
          <input type="hidden" name={envXsrfToken} value={csrfToken} />
          <input type="hidden" name="challenge" value={challenge} />
          <table>
            <tr>
              <td>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={hint}
                  placeholder="email@foobar.com"
                />
              </td>
              <td>(it's "foo@bar.com")</td>
            </tr>
            <tr>
              <td>
                <input type="password" id="password" name="password" />
              </td>
              <td>(it's "foobar")</td>
            </tr>
          </table>
          <input type="checkbox" id="remember" name="remember" value="1" />
          <label for="remember">Remember me</label>
          <br />
          <input type="submit" id="accept" name="submit" value="Log in" />
          <input type="submit" id="reject" name="submit" value="Deny access" />
        </form>
      </>
    ),
  })
}
