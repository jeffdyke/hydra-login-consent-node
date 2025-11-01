/**
 * Hydra Admin API service using TaskEither
 * Wraps all Hydra OAuth2 API operations
 */
import * as TE from 'fp-ts/TaskEither'
import { pipe } from 'fp-ts/function'
import type { OAuth2Api } from '@ory/hydra-client-fetch/dist/index.js'
import type {
  OAuth2LoginRequest,
  AcceptOAuth2LoginRequest,
  OAuth2RedirectTo,
  OAuth2ConsentRequest,
  AcceptOAuth2ConsentRequest,
  OAuth2LogoutRequest,
} from '@ory/client-fetch'
import { HttpError } from '../errors.js'

/**
 * Hydra service interface
 */
export interface HydraService {
  /**
   * Get login request details
   */
  getLoginRequest: (
    challenge: string
  ) => TE.TaskEither<HttpError, OAuth2LoginRequest>

  /**
   * Accept login request
   */
  acceptLoginRequest: (
    challenge: string,
    body: AcceptOAuth2LoginRequest
  ) => TE.TaskEither<HttpError, OAuth2RedirectTo>

  /**
   * Get consent request details
   */
  getConsentRequest: (
    challenge: string
  ) => TE.TaskEither<HttpError, OAuth2ConsentRequest>

  /**
   * Accept consent request
   */
  acceptConsentRequest: (
    challenge: string,
    body: AcceptOAuth2ConsentRequest
  ) => TE.TaskEither<HttpError, OAuth2RedirectTo>

  /**
   * Get logout request details
   */
  getLogoutRequest: (
    challenge: string
  ) => TE.TaskEither<HttpError, OAuth2LogoutRequest>

  /**
   * Accept logout request
   */
  acceptLogoutRequest: (
    challenge: string
  ) => TE.TaskEither<HttpError, OAuth2RedirectTo>

  /**
   * Reject logout request
   */
  rejectLogoutRequest: (
    challenge: string
  ) => TE.TaskEither<HttpError, void>
}

/**
 * Create Hydra service from OAuth2Api client
 */
export const createHydraService = (client: OAuth2Api): HydraService => {
  /**
   * Helper to wrap Hydra API calls in TaskEither
   */
  const wrapHydraCall = <A>(
    operation: () => Promise<A>,
    operationName: string
  ): TE.TaskEither<HttpError, A> =>
    TE.tryCatch(
      operation,
      (error) => {
        // Try to extract status code from error
        const err = error as any
        if (err.response) {
          return HttpError.status(
            err.response.status || 500,
            err.response.statusText || 'Hydra API error',
            err.response.data
          )
        }
        return HttpError.network(`Hydra ${operationName} failed`, error)
      }
    )

  return {
    getLoginRequest: (challenge: string) =>
      wrapHydraCall(
        () => client.getOAuth2LoginRequest({ loginChallenge: challenge }),
        'getLoginRequest'
      ),

    acceptLoginRequest: (challenge: string, body: AcceptOAuth2LoginRequest) =>
      wrapHydraCall(
        () =>
          client.acceptOAuth2LoginRequest({
            loginChallenge: challenge,
            acceptOAuth2LoginRequest: body,
          }),
        'acceptLoginRequest'
      ),

    getConsentRequest: (challenge: string) =>
      wrapHydraCall(
        () => client.getOAuth2ConsentRequest({ consentChallenge: challenge }),
        'getConsentRequest'
      ),

    acceptConsentRequest: (challenge: string, body: AcceptOAuth2ConsentRequest) =>
      wrapHydraCall(
        () =>
          client.acceptOAuth2ConsentRequest({
            consentChallenge: challenge,
            acceptOAuth2ConsentRequest: body,
          }),
        'acceptConsentRequest'
      ),

    getLogoutRequest: (challenge: string) =>
      wrapHydraCall(
        () => client.getOAuth2LogoutRequest({ logoutChallenge: challenge }),
        'getLogoutRequest'
      ),

    acceptLogoutRequest: (challenge: string) =>
      wrapHydraCall(
        () => client.acceptOAuth2LogoutRequest({ logoutChallenge: challenge }),
        'acceptLogoutRequest'
      ),

    rejectLogoutRequest: (challenge: string) =>
      wrapHydraCall(
        async () => {
          await client.rejectOAuth2LogoutRequest({ logoutChallenge: challenge })
        },
        'rejectLogoutRequest'
      ),
  }
}
