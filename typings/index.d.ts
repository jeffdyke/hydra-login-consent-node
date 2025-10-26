import "express-session"

declare module "express-session" {
  interface SessionData {
    state?: string | undefined
    codeVerifier?: string | undefined
  }
}
