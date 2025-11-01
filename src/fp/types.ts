/**
 * Core fp-ts type aliases and utilities for the application
 */
import * as TE from 'fp-ts/TaskEither'
import * as RTE from 'fp-ts/ReaderTaskEither'
import * as E from 'fp-ts/Either'
import * as O from 'fp-ts/Option'
import { pipe } from 'fp-ts/function'

/**
 * Type alias for asynchronous operations that can fail
 * TaskEither<E, A> represents an async computation that:
 * - Returns Left<E> on failure
 * - Returns Right<A> on success
 */
export type AsyncResult<E, A> = TE.TaskEither<E, A>

/**
 * Type alias for dependency-injected async operations
 * ReaderTaskEither<R, E, A> represents a computation that:
 * - Requires environment R (dependencies)
 * - Returns Left<E> on failure
 * - Returns Right<A> on success
 */
export type IOWithDeps<R, E, A> = RTE.ReaderTaskEither<R, E, A>

/**
 * Re-export commonly used fp-ts modules
 */
export { TE, RTE, E, O, pipe }

/**
 * Utility type for extracting the success type from TaskEither
 */
export type Unwrap<T> = T extends TE.TaskEither<any, infer A> ? A : never

/**
 * Utility type for extracting the error type from TaskEither
 */
export type UnwrapError<T> = T extends TE.TaskEither<infer E, any> ? E : never
