import Html from '@kitajs/html'
import { Layout } from './components/Layout.js'

export interface CallbackProps {
  url: string
}

export function Callback({ url }: CallbackProps): string {
  return Layout({
    title: 'Callback',
    children: (
      <>
        <h1>Callback URL</h1>
        <p>
          <code>{url}</code>
        </p>
      </>
    ),
  })
}
