/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import { writeFileSync } from 'node:fs'
import { forkeMailTemplateSources } from '../lib/email'

async function main() {
  const out = process.argv[2]
  const sources = forkeMailTemplateSources().map((t) => ({
    ...t,
    kind: t.kind ?? 'transactional',
  }))

  if (out) {
    writeFileSync(out, JSON.stringify(sources))
    console.log(`Wrote ${sources.length} templates to ${out}`)
  } else {
    const base = (process.env.EMAIL_API_URL || 'https://mail.forke.space/api/forke-mail').replace(/\/api\/forke-mail\/?$/, '')
    const key = (process.env.FORKE_MAIL_API_KEY || '').replace(/^["']|["']$/g, '')
    if (!key) throw new Error('FORKE_MAIL_API_KEY is not set')
    const headers = {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    }
    const list = await fetch(`${base}/api/templates`, { headers }).then((r) => r.json())
    const existing = new Map<string, { id: string; kind: string }>(
      (list.templates || []).map((t: { id: string; name: string; kind: string }) => [t.name.toLowerCase(), t]),
    )
    for (const t of sources) {
      const found = existing.get(t.name.toLowerCase())
      const id = found?.id
      if (found) t.kind = found.kind as 'transactional' | 'marketing'
      const res = await fetch(`${base}/api/templates${id ? `/${id}` : ''}`, {
        method: id ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify(t),
      })
      console.log(`${id ? 'updated' : 'created'} ${t.name}: ${res.status}`)
    }
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
