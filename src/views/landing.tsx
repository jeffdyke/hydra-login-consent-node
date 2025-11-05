import Html from '@kitajs/html'
import { Layout } from './components/Layout.js'

export interface IndexProps {
  title?: string
}

export function Index({ title = 'OAuth 2.0 & OpenID Connect' }: IndexProps): string {
  return Layout({
    title,
    children: (
      <>
        <h1>{title}</h1>
        <p>
          This is the login & consent app for the OAuth 2.0 Authorization Server powered by Ory
          Hydra.
        </p>
      </>
    ),
  })
}
