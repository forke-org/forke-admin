import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sandboxRepos } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export async function GET() {
  try {
    const mirrors = await db
      .select()
      .from(sandboxRepos)
      .orderBy(desc(sandboxRepos.createdAt))

    return NextResponse.json(mirrors)
  } catch (error: any) {
    console.error('Fetch mirrors error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
