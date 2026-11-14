/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:dummy@127.0.0.1:5432/forkedb'

const connectionOptions: postgres.Options<{}> = {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: false,
}

export let client: postgres.Sql

if (process.env.NODE_ENV === 'production') {
  client = postgres(dbUrl, connectionOptions)
} else {
  if (!(global as any).postgresClient) {
    (global as any).postgresClient = postgres(dbUrl, connectionOptions)
  }
  client = (global as any).postgresClient
}

export const db = drizzle(client, { schema })
export * from './schema'
