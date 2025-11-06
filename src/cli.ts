#!/usr/bin/env node
/**
 * CLI tool for running Effect functions from authFlow
 *
 * Usage:
 *   npm run cli -- list-clients
 *   npm run cli -- get-client <client-id>
 *   npm run cli -- create-client <client-name>
 *   npm run cli -- new-client <client-name>
 */

import { Effect, Exit, Cause, Layer } from 'effect'
// import { jsonLogger } from 'effect/Logger'
import { type OAuth2ApiService, OAuth2ApiServiceLive } from './api/oauth2.js'
import * as authFlow from './authFlow.js'
import { appConfig } from './config.js'
import { createLoggerLayer } from './fp/bootstrap.js'
import { HttpStatusError, NetworkError } from './fp/errors.js'
import jsonLogger from './logging.js'


/**
 * Setup OAuth2 API Layer with configuration
 */
const setupLayer = () => {

  const oauth2Config = {
    basePath: appConfig.hydraInternalAdmin,
    headers: {
      'Content-Type': 'application/json',
    },
  }

  return Layer.merge(
    createLoggerLayer(jsonLogger),
    OAuth2ApiServiceLive(oauth2Config)
  )
}

/**
 * Run an Effect program with the configured runtime
 */
const runEffect = async <A, E>(
  program: Effect.Effect<A, E, OAuth2ApiService>
): Promise<Exit.Exit<A, E>> => {
  const layer = setupLayer()
  const runnable = Effect.provide(program, layer)
  return Effect.runPromiseExit(runnable)
}

interface FormattedHttpStatusError {
  type: 'HttpStatusError';
  status: number;
  statusText: string;
  body: unknown;
}

interface FormattedNetworkError {
  type: 'NetworkError';
  message: string;
  cause: unknown;
}

interface FormattedUnexpectedError {
  type: 'UnexpectedError';
  name: string;
  message: string;
  stack?: string;
}

interface GenericError {
  error: string;
}

interface GenericDefect {
  defect: string;
}

type FormattedError =
  | FormattedHttpStatusError
  | FormattedNetworkError
  | FormattedUnexpectedError
  | GenericError
  | GenericDefect;

/**
 * Pretty print an error cause
 */
const formatError = (cause: Cause.Cause<unknown>): string => {
  const failures = Cause.failures(cause)
  const defects = Cause.defects(cause)

  const formatFailure = (failure: unknown): FormattedError => {
    if (failure instanceof HttpStatusError) {
      return {
        type: 'HttpStatusError',
        status: failure.status,
        statusText: failure.statusText,
        body: failure.body,
      }
    }
    if (failure instanceof NetworkError) {
      return {
        type: 'NetworkError',
        message: failure.message,
        cause: failure.cause,
      }
    }
    if (typeof failure === 'object' && failure !== null) {
      return failure as FormattedError
    }
    return { error: String(failure) }
  }

  const formatDefect = (defect: unknown): FormattedError => {
    if (defect instanceof Error) {
      return {
        type: 'UnexpectedError',
        name: defect.name,
        message: defect.message,
        stack: defect.stack,
      }
    }
    return { defect: String(defect) }
  }

  const errors = [
    ...Array.from(failures).map(formatFailure),
    ...Array.from(defects).map(formatDefect)
  ]

  if (errors.length === 0) {
    return JSON.stringify({
      error: 'Unknown error',
      cause: Cause.pretty(cause)
    }, null, 2)
  }

  return errors.length === 1
    ? JSON.stringify(errors[0], null, 2)
    : JSON.stringify(errors, null, 2)
}

/**
 * Format and print result
 */
const printResult = (exit: Exit.Exit<unknown, unknown>) => {
  if (Exit.isSuccess(exit)) {
    jsonLogger.info('\nSuccess!')
    jsonLogger.info(JSON.stringify(exit.value, null, 2))
  } else {
    jsonLogger.error('\nError!')
    jsonLogger.error(formatError(exit.cause))
    process.exit(1)
  }
}

/**
 * Command handlers
 */
type CommandHandler = (...args: string[]) => Promise<void>;

const commands: Record<string, CommandHandler> = {
  'list-clients': async () => {
    jsonLogger.info('Listing all OAuth2 clients...')
    const program = authFlow.listClients()
    const exit = await runEffect(program)
    printResult(exit)
  },

  'get-client': async (clientId: string) => {
    if (!clientId) {
      jsonLogger.error('Error: client-id is required')
      jsonLogger.error('Usage: cli get-client <client-id>')
      process.exit(1)
    }
    jsonLogger.info(`Getting client: ${clientId}...`)
    const program = authFlow.getClient(clientId)
    const exit = await runEffect(program)
    printResult(exit)
  },

  'safe-get-client': async (clientId: string) => {
    if (!clientId) {
      jsonLogger.error('Error: client-id is required')
      jsonLogger.error('Usage: cli safe-get-client <client-id>')
      process.exit(1)
    }
    jsonLogger.info(`Safely getting client: ${clientId}...`)
    const program = authFlow.safeGetClient(clientId)
    const exit = await runEffect(program)
    printResult(exit)
  },

  'create-client': async (clientId: string) => {
    if (!clientId) {
      jsonLogger.error('Error: client-id is required')
      jsonLogger.error('Usage: cli create-client <client-id>')
      process.exit(1)
    }
    jsonLogger.info(`Creating client with validation: ${clientId}...`)
    const program = authFlow.createClient(clientId)
    const exit = await runEffect(program)
    printResult(exit)
  },

  'new-client': async (clientName: string) => {
    if (!clientName) {
      jsonLogger.error('Error: client-name is required')
      jsonLogger.error('Usage: cli new-client <client-name>')
      process.exit(1)
    }
    jsonLogger.info(`Creating new client: ${clientName}...`)
    const program = authFlow.newClient(clientName)
    const exit = await runEffect(program)
    printResult(exit)
  },

  'help': async () => {
    jsonLogger.info(`
CLI for running Effect functions from authFlow

Usage: npm run cli -- <command> [arguments]

Commands:
  list-clients              List all OAuth2 clients
  get-client <client-id>    Get a specific client by ID
  safe-get-client <id>      Get a client with error handling
  create-client <id>        Create client with validation
  new-client <name>         Create a new OAuth2 client
  'help': async () => {
    const helpText = [
      'CLI for running Effect functions from authFlow',
      '',
      'Usage: npm run cli -- <command> [arguments]',
      '',
      'Commands:',
      '  list-clients              List all OAuth2 clients',
      '  get-client <client-id>    Get a specific client by ID',
      '  safe-get-client <id>      Get a client with error handling',
      '  create-client <id>        Create client with validation',
      '  new-client <n>            Create a new OAuth2 client',
      '  help                      Show this help message',
      '',
      'Examples:',
      '  npm run cli -- list-clients',
      '  npm run cli -- get-client abc123',
      '  npm run cli -- new-client "My Application"',
      '',
      'Environment:',
      '  Requires proper configuration in env files',
      '  - HYDRA_ADMIN_URL for Ory Hydra admin endpoint',
      '  - BASE_URL for application base URL',
    ].join('\n')
    jsonLogger.error(helpText)
`)
  }
}

/**
 * Main CLI entry point
 */
const main = async () => {
  const args = process.argv.slice(2)
  const command = args[0]
  const params = args.slice(1)

  if (!command || command === 'help') {
    await commands.help()
    return
  }

  const handler = commands[command as keyof typeof commands]

  if (!handler) {
    jsonLogger.error(`Unknown command: ${command}`)
    await commands.help()
    process.exit(1)
  }

  try {
    await handler(...params)
  } catch (error) {
    jsonLogger.error('Unexpected error:', error)
    process.exit(1)
  }
}

// Run the CLI
main().catch((error) => {
  jsonLogger.error('Fatal error:', error)
  process.exit(1)
})
