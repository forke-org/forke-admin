import { NextResponse } from 'next/server'
import { activeJobs } from '@/lib/jobs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const jobId = searchParams.get('jobId')

  if (!jobId) {
    return NextResponse.json({ error: 'Missing jobId parameter' }, { status: 400 })
  }

  const job = activeJobs.get(jobId)

  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 })
  }

  return NextResponse.json({
    id: job.id,
    status: job.status,
    progress: job.progress,
    logs: job.logs
  })
}
