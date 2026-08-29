/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined')
}

const sql = postgres(connectionString, { max: 1 })
const db = drizzle(sql)

async function main() {
  console.log('Cleaning database...')
  console.log('Dropping public and drizzle schemas CASCADE...')
  await sql`DROP SCHEMA IF EXISTS public CASCADE`
  await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`
  
  console.log('Recreating public schema...')
  await sql`CREATE SCHEMA public`
  await sql`GRANT ALL ON SCHEMA public TO postgres`
  await sql`GRANT ALL ON SCHEMA public TO public`
  
  console.log('Running migrations synchronously...')
  await migrate(db, { migrationsFolder: 'drizzle/migrations' })
  
  console.log('Database cleaned and migrated successfully!')
  await sql.end()
  process.exit(0)
}

main().catch((err) => {
  console.error('Failed to clean and migrate database:', err)
  process.exit(1)
})
