import Html from '@kitajs/html'
import { Layout } from '../components/Layout.js'

export interface DeviceVerifyProps {
  action: string
  envXsrfToken: string
  csrfToken: string
  challenge: string
  error?: string
  userCode?: string
}

export function DeviceVerify({
  action,
  envXsrfToken,
  csrfToken,
  error,
  userCode = '',
}: DeviceVerifyProps): string {
  return Layout({
    title: 'Device Verification',
    children: (
      <>
        <h1>Device Verification</h1>
        {error && (
          <p style="color: red;">
            <strong>Error:</strong> {error}
          </p>
        )}
        <p>Please enter the code shown on your device:</p>

        <form action={action} method="POST">
          <input type="hidden" name={envXsrfToken} value={csrfToken} />
          <input
            type="text"
            id="user_code"
            name="user_code"
            value={userCode}
            placeholder="XXXX-XXXX"
            required
          />
          <br />
          <input type="submit" value="Verify" />
        </form>
      </>
    ),
  })
}
