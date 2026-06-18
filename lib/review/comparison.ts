/**
 * Baseline Comparison Engine
 * Compares PR deterministic results against the baseline snapshot
 * to identify regressions, pre-existing debt, and improvements.
 */

import { CategoryResult } from './runner'

export interface ComparisonReport {
  regressions: Record<string, number>
  baselineDebt: Record<string, number>
  improvements: Record<string, number>
  verdict: 'pass' | 'warn' | 'fail'
  summaryHtml: string
}

export function compareToBaseline(
  baselineResults: Record<string, CategoryResult> | null,
  prResults: Record<string, CategoryResult>
): ComparisonReport {
  const regressions: Record<string, number> = {}
  const baselineDebt: Record<string, number> = {}
  const improvements: Record<string, number> = {}

  let hasBlockingRegression = false
  let hasNonBlockingRegression = false

  const isBlocking = (cat: string) =>
    ['build', 'type_checks', 'unit_tests', 'integration_tests', 'e2e_tests'].includes(cat)

  const categories = Object.keys(prResults)

  for (const cat of categories) {
    const prVal = prResults[cat]
    const baseVal = baselineResults ? baselineResults[cat] : null

    const prCount = prVal.issuesCount || (prVal.status === 'fail' || prVal.status === 'warn' ? 1 : 0)
    const baseCount = baseVal
      ? baseVal.issuesCount || (baseVal.status === 'fail' || baseVal.status === 'warn' ? 1 : 0)
      : 0

    if (prCount > baseCount) {
      const diff = prCount - baseCount
      regressions[cat] = diff
      if (isBlocking(cat)) hasBlockingRegression = true
      else hasNonBlockingRegression = true
    } else {
      if (prCount > 0 && baseCount > 0) baselineDebt[cat] = Math.min(prCount, baseCount)
      if (baseCount > prCount) improvements[cat] = baseCount - prCount
    }
  }

  let verdict: 'pass' | 'warn' | 'fail' = 'pass'
  if (hasBlockingRegression) verdict = 'fail'
  else if (hasNonBlockingRegression) verdict = 'warn'

  const summaryHtml = generateReportHtml(prResults, baselineResults, {
    regressions, baselineDebt, improvements, verdict,
  })

  return { regressions, baselineDebt, improvements, verdict, summaryHtml }
}

function generateReportHtml(
  prResults: Record<string, CategoryResult>,
  baselineResults: Record<string, CategoryResult> | null,
  comp: {
    regressions: Record<string, number>
    baselineDebt: Record<string, number>
    improvements: Record<string, number>
    verdict: 'pass' | 'warn' | 'fail'
  }
): string {
  const verdictLabels = {
    pass: '<span style="color: #10b981; font-weight: 800;">✅ PASS</span>',
    warn: '<span style="color: #f59e0b; font-weight: 800;">⚠️ WARNINGS</span>',
    fail: '<span style="color: #ef4444; font-weight: 800;">❌ FAILED</span>',
  }

  let html = `
    <div style="background-color: #09090b; border: 1px solid #27272a; border-radius: 12px; padding: 24px; font-family: sans-serif; color: #f4f4f5; max-width: 800px; margin: 0 auto;">
      <h2 style="margin-top: 0; font-size: 20px; font-weight: 800; border-bottom: 1px solid #27272a; padding-bottom: 12px;">
        Forke Deterministic Review Report
      </h2>
      <div style="margin-bottom: 20px; font-size: 15px;">
        <strong>Overall Verdict:</strong> ${verdictLabels[comp.verdict]}
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; text-align: left;">
        <thead>
          <tr style="border-bottom: 2px solid #27272a;">
            <th style="padding: 8px; font-weight: 700; font-size: 13px; color: #a1a1aa; text-transform: uppercase;">Category</th>
            <th style="padding: 8px; font-weight: 700; font-size: 13px; color: #a1a1aa; text-transform: uppercase;">PR Status</th>
            <th style="padding: 8px; font-weight: 700; font-size: 13px; color: #a1a1aa; text-transform: uppercase;">Issues</th>
            <th style="padding: 8px; font-weight: 700; font-size: 13px; color: #a1a1aa; text-transform: uppercase;">Comparison</th>
          </tr>
        </thead>
        <tbody>`

  for (const cat of Object.keys(prResults)) {
    const prVal = prResults[cat]
    const statusText =
      prVal.status === 'pass' ? '<span style="color: #10b981;">Pass</span>'
      : prVal.status === 'warn' ? '<span style="color: #f59e0b;">Warn</span>'
      : prVal.status === 'fail' ? '<span style="color: #ef4444;">Fail</span>'
      : '<span style="color: #71717a;">Skip</span>'

    let comparisonText = '<span style="color: #71717a;">No change</span>'
    if (comp.regressions[cat]) {
      comparisonText = `<span style="color: #ef4444;">+${comp.regressions[cat]} new issues (Regression)</span>`
    } else if (comp.improvements[cat]) {
      comparisonText = `<span style="color: #10b981;">-${comp.improvements[cat]} fixed (Improvement!)</span>`
    } else if (comp.baselineDebt[cat]) {
      comparisonText = `<span style="color: #f59e0b;">${comp.baselineDebt[cat]} pre-existing (Debt)</span>`
    }

    html += `
          <tr style="border-bottom: 1px solid #18181b;">
            <td style="padding: 10px 8px; font-weight: 600; font-size: 14px; text-transform: capitalize;">${cat.replace('_', ' ')}</td>
            <td style="padding: 10px 8px; font-size: 14px;">${statusText}</td>
            <td style="padding: 10px 8px; font-size: 14px;">${prVal.issuesCount || 0}</td>
            <td style="padding: 10px 8px; font-size: 13px; font-weight: 500;">${comparisonText}</td>
          </tr>`
  }

  html += `
        </tbody>
      </table>
      <div style="font-size: 12px; color: #71717a; border-top: 1px solid #27272a; padding-top: 12px; text-align: center;">
        Deterministic review by Forke Complete Review Engine.
      </div>
    </div>`

  return html
}
