import "express-session"

declare module "express-session" {
  interface SessionData {
    state?: string | undefined
    codeVerifier?: string | undefined
    codeChallenge?: string | undefined
    codeChallengeMethod: string | undefined
    pkceKey: string | undefined
  }
}
