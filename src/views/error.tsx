import Html from '@kitajs/html'
import { Layout } from './components/Layout.js'

export interface ErrorProps {
  message: string
  stack?: string
}

export function ErrorPage({ message, stack }: ErrorProps): string {
  return Layout({
    title: 'Error',
    children: (
      <>
        <h1>An error occurred</h1>
        <h2>{message}</h2>
        {stack && (
          <pre>
            <code>{stack}</code>
          </pre>
        )}
      </>
    ),
  })
}
