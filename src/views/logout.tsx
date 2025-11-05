import Html from '@kitajs/html'
import { Layout } from './components/Layout.js'

export interface LogoutProps {
  action: string
  envXsrfToken: string
  csrfToken: string
  challenge: string
}

export function Logout({ action, envXsrfToken, csrfToken, challenge }: LogoutProps): string {
  return Layout({
    title: 'Logout',
    children: (
      <>
        <h1>Logout</h1>
        <p>Do you want to log out?</p>

        <form action={action} method="POST">
          <input type="hidden" name={envXsrfToken} value={csrfToken} />
          <input type="hidden" name="challenge" value={challenge} />

          <input type="submit" id="accept" name="submit" value="Yes" />
          <input type="submit" id="reject" name="submit" value="No" />
        </form>
      </>
    ),
  })
}
