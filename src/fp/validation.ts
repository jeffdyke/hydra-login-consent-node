/**
 * Pure validation functions using fp-ts Either for error handling
 */
import * as E from 'fp-ts/Either'
import * as A from 'fp-ts/Array'
import { pipe } from 'fp-ts/function'
import * as t from 'io-ts'
import { PathReporter } from 'io-ts/PathReporter'
import { OAuthError, ValidationError } from './errors.js'
import { PKCEMethod } from './domain.js'
import crypto from 'crypto'

/**
 * Validate io-ts codec and return Either
 */
export const validateCodec = <C extends t.Mixed>(
  codec: C,
  value: unknown
): E.Either<ValidationError, t.TypeOf<C>> => {
  const result = codec.decode(value)
  return pipe(
    result,
    E.mapLeft((errors) =>
      ValidationError.codecError(PathReporter.report(result), value)
    )
  )
}

/**
 * Pure PKCE validation function
 * Takes a code_verifier, challenge, and method and returns Either
 */
export const validatePKCE = (
  verifier: string,
  challenge: string,
  method: PKCEMethod
): E.Either<OAuthError, true> => {
  try {
    let computedChallenge: string

    if (method === 'S256') {
      computedChallenge = crypto
        .createHash('sha256')
        .update(verifier)
        .digest('base64url')
    } else if (method === 'plain') {
      computedChallenge = verifier
    } else {
      return E.left(
        OAuthError.invalidPKCE(challenge, verifier, `Unknown method: ${method}`)
      )
    }

    if (computedChallenge === challenge) {
      return E.right(true)
    } else {
      return E.left(
        OAuthError.invalidPKCE(
          challenge,
          verifier,
          `Challenge mismatch: expected ${challenge}, got ${computedChallenge}`
        )
      )
    }
  } catch (error) {
    return E.left(
      OAuthError.invalidPKCE(challenge, verifier, `Validation error: ${error}`)
    )
  }
}

/**
 * Validate OAuth2 scopes
 * Ensures all requested scopes are within the granted scopes
 */
export const validateScopes = (
  requestedScopes: string[],
  grantedScopes: string[]
): E.Either<OAuthError, true> => {
  const hasAllScopes = requestedScopes.every((s) => grantedScopes.includes(s))

  return hasAllScopes
    ? E.right(true)
    : E.left(OAuthError.invalidScope(requestedScopes, grantedScopes))
}

/**
 * Parse space-separated scope string into array
 */
export const parseScopeString = (scope: string): string[] => {
  return scope.split(' ').filter((s) => s.length > 0)
}

/**
 * Validate required field exists
 */
export const validateRequired = <T>(
  field: string,
  value: T | null | undefined
): E.Either<ValidationError, T> => {
  return value != null
    ? E.right(value)
    : E.left(ValidationError.requiredField(field))
}

/**
 * Validate that a value is not empty string
 */
export const validateNonEmpty = (
  field: string,
  value: string
): E.Either<ValidationError, string> => {
  return value.trim().length > 0
    ? E.right(value)
    : E.left(ValidationError.invalidFormat(field, 'non-empty string', value))
}

/**
 * Sequence array of Eithers into Either of array
 * Collects all errors if any exist
 */
export const sequenceValidations = <E, A>(
  validations: E.Either<E, A>[]
): E.Either<E[], A[]> => {
  const lefts = validations.filter(E.isLeft)
  const rights = validations.filter(E.isRight)

  if (lefts.length > 0) {
    return E.left(lefts.map((l) => l.left))
  } else {
    return E.right(rights.map((r) => r.right))
  }
}
