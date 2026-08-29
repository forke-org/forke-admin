'use client'

/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import React, { useState, useEffect } from 'react'
import { executeSQLQuery } from '@/lib/db-client-actions'
import { Play, Copy, Check, Clock, Save, FileText, Code, ChevronRight, Terminal, RefreshCw } from 'lucide-react'
import { toast } from '@/components/shared/Toast'

import { cn } from '@/lib/utils/cn'

interface SavedQuery {
  id: string
  name: string
  query: string
  timestamp: string
}

interface DatabaseSqlEditorPanelProps {
  currentAdmin: {
    id: string
    name: string
    role: 'super_admin' | 'admin'
  } | null
}

export default function DatabaseSqlEditorPanel({ currentAdmin }: DatabaseSqlEditorPanelProps) {
  const isSuperAdmin = currentAdmin?.role === 'super_admin'
  
  const [queryName, setQueryName] = useState('Untitled Query')
  const [sqlQuery, setSqlQuery] = useState<string>(
    '-- Write your SQL query here...\nSELECT * FROM public.users LIMIT 10;'
  )
  const [isRunning, setIsRunning] = useState(false)
  const [activeSidebarTab, setActiveSidebarTab] = useState<'saved' | 'history'>('saved')

  // History and Saved queries states (persisted in localStorage)
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([])
  const [historyQueries, setHistoryQueries] = useState<SavedQuery[]>([])

  // Query Results states
  const [results, setResults] = useState<{
    headers: string[]
    rows: any[]
    affectedRows: number
    duration: number
    error?: string
  } | null>(null)

  useEffect(() => {
    // Load saved queries and history
    const saved = localStorage.getItem('forke_admin_sql_saved')
    const history = localStorage.getItem('forke_admin_sql_history')
    if (saved) setSavedQueries(JSON.parse(saved))
    if (history) setHistoryQueries(JSON.parse(history))
  }, [])

  function persistSaved(items: SavedQuery[]) {
    setSavedQueries(items)
    localStorage.setItem('forke_admin_sql_saved', JSON.stringify(items))
  }

  function persistHistory(items: SavedQuery[]) {
    setHistoryQueries(items)
    localStorage.setItem('forke_admin_sql_history', JSON.stringify(items))
  }

  async function handleRunQuery() {
    if (!isSuperAdmin) {
      toast('Unauthorized: Only Super Admins can execute custom SQL commands.', 'error')
      return
    }
    if (!sqlQuery.trim()) return
    setIsRunning(true)
    setResults(null)

    const res = await executeSQLQuery(sqlQuery)
    if (res.success) {
      setResults({
        headers: res.headers || [],
        rows: res.rows || [],
        affectedRows: res.affectedRows || 0,
        duration: res.duration || 0
      })

      // Add to history
      const newHistoryItem: SavedQuery = {
        id: Math.random().toString(),
        name: sqlQuery.trim().slice(0, 40) + (sqlQuery.length > 40 ? '...' : ''),
        query: sqlQuery,
        timestamp: new Date().toLocaleTimeString()
      }
      persistHistory([newHistoryItem, ...historyQueries.slice(0, 19)])
      toast('Query executed successfully!', 'success')
    } else {
      setResults({
        headers: [],
        rows: [],
        affectedRows: 0,
        duration: 0,
        error: res.error || 'Failed to execute query.'
      })
      toast(res.error || 'Query failed.', 'error')
    }
    setIsRunning(false)
  }

  function handleSaveQuery() {
    if (!sqlQuery.trim()) return
    const newSaved: SavedQuery = {
      id: Math.random().toString(),
      name: queryName,
      query: sqlQuery,
      timestamp: new Date().toLocaleDateString()
    }
    persistSaved([newSaved, ...savedQueries])
    toast('Query saved to list!', 'success')
  }

  return (
    <div className="flex-grow flex h-full min-h-0 text-left bg-[#070709] text-white font-sans overflow-hidden">
      
      {/* 1. Left SQL Queries Sidebar */}
      <aside className="w-60 border-r border-white/[0.06] flex flex-col shrink-0 bg-[#0b0b0e]">
        
        {/* Header Tabs */}
        <div className="p-3 border-b border-white/[0.06] flex items-center gap-2 shrink-0">
          <button
            onClick={() => setActiveSidebarTab('saved')}
            className={`flex-1 py-1 rounded text-center text-xs font-semibold transition-colors cursor-pointer ${
              activeSidebarTab === 'saved'
                ? "bg-white/[0.05] text-white border border-white/[0.08]"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            Saved
          </button>
          <button
            onClick={() => setActiveSidebarTab('history')}
            className={`flex-1 py-1 rounded text-center text-xs font-semibold transition-colors cursor-pointer ${
              activeSidebarTab === 'history'
                ? "bg-white/[0.05] text-white border border-white/[0.08]"
                : "text-white/40 hover:text-white/70"
            }`}
          >
            History
          </button>
        </div>

        {/* Scrollable List */}
        <div className="flex-grow overflow-y-auto p-2 space-y-1">
          {activeSidebarTab === 'saved' ? (
            savedQueries.length === 0 ? (
              <div className="text-center py-8 text-xs text-white/30 space-y-1">
                <FileText className="w-4 h-4 mx-auto opacity-40" />
                <div>No saved queries</div>
              </div>
            ) : (
              savedQueries.map(q => (
                <div
                  key={q.id}
                  onClick={() => {
                    setQueryName(q.name)
                    setSqlQuery(q.query)
                  }}
                  className="p-2 rounded hover:bg-white/[0.02] text-xs font-mono border border-transparent hover:border-white/[0.04] transition-all cursor-pointer space-y-1 text-left"
                >
                  <div className="text-white/80 font-semibold truncate">{q.name}</div>
                  <div className="text-[10px] text-white/30">{q.timestamp}</div>
                </div>
              ))
            )
          ) : (
            historyQueries.length === 0 ? (
              <div className="text-center py-8 text-xs text-white/30 space-y-1">
                <Clock className="w-4 h-4 mx-auto opacity-40" />
                <div>No query history</div>
              </div>
            ) : (
              historyQueries.map(q => (
                <div
                  key={q.id}
                  onClick={() => setSqlQuery(q.query)}
                  className="p-2 rounded hover:bg-white/[0.02] text-xs font-mono border border-transparent hover:border-white/[0.04] transition-all cursor-pointer space-y-1 text-left"
                >
                  <div className="text-white/70 truncate block">{q.name}</div>
                  <div className="text-[9px] text-white/30 font-sans">{q.timestamp}</div>
                </div>
              ))
            )
          )}
        </div>
      </aside>

      {/* 2. Main Editor and Results Area */}
      <main className="flex-grow flex flex-col min-w-0 bg-[#070709] h-full relative">
        
        {/* Main Toolbar */}
        <div className="h-12 border-b border-white/[0.06] flex items-center justify-between px-4 shrink-0 bg-[#0b0b0e] select-none">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-accent text-xs font-medium text-white/80 focus:outline-none py-0.5 px-1 rounded transition-colors"
            />
            <button
              onClick={handleSaveQuery}
              className="p-1 rounded hover:bg-white/5 text-white/50 hover:text-white transition-colors cursor-pointer"
              title="Save query"
            >
              <Save className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5 text-white/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              production
            </div>
            <span className="text-white/20">|</span>
            <div className="text-white/60">neondb</div>
          </div>
        </div>

        {/* Query Editor Box */}
        <div className="flex-grow relative min-h-0 border-b border-white/[0.06] flex flex-col">
          <div className="absolute left-0 top-0 bottom-0 w-10 bg-white/[0.005] border-r border-white/[0.03] select-none text-[10px] text-white/20 font-mono flex flex-col items-center py-4 gap-1.5 leading-5">
            {Array.from({ length: 15 }).map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
          <textarea
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            readOnly={!isSuperAdmin}
            className="w-full h-full pl-14 pr-4 py-4 bg-transparent resize-none font-mono text-[13px] leading-relaxed text-white focus:outline-none focus:ring-0 disabled:opacity-50"
            spellCheck={false}
            onKeyDown={(e) => {
              if (isSuperAdmin && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault()
                handleRunQuery()
              }
            }}
          />

          {/* Float Play Button */}
          <button
            onClick={handleRunQuery}
            disabled={isRunning || !isSuperAdmin}
            className={cn(
              "absolute right-4 bottom-4 h-9 px-4 rounded-lg font-semibold text-xs flex items-center gap-1.5 shadow-lg transition-all",
              isSuperAdmin 
                ? "bg-accent text-[#0a0a0a] hover:bg-accent/80 cursor-pointer disabled:opacity-50" 
                : "bg-white/10 text-white/40 cursor-not-allowed"
            )}
            title={!isSuperAdmin ? "Only Super Admins can execute SQL commands" : ""}
          >
            {isRunning ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className={cn("w-3.5 h-3.5", isSuperAdmin ? "fill-[#0a0a0a]" : "text-white/40")} />
            )}
            <span>Run</span>
            {isSuperAdmin && (
              <span className="bg-[#0a0a0a]/10 px-1 rounded text-[8px] font-sans font-bold">⌘↵</span>
            )}
          </button>

          {!isSuperAdmin && (
            <div className="absolute inset-0 bg-[#070709]/60 backdrop-blur-[2px] flex items-center justify-center pointer-events-none select-none">
              <div className="bg-[#0a0a0a] border border-white/[0.08] px-4 py-3 rounded-xl flex items-center gap-2.5 shadow-2xl max-w-sm text-center flex-col pointer-events-auto">
                <Terminal className="w-5 h-5 text-accent animate-pulse" />
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-white/80">View Only Console</div>
                  <p className="text-[10px] text-white/40 leading-normal">
                    You are logged in as an Admin. Only Super Admins have permission to write queries and execute database transactions.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results/Error Panel */}
        <div className="h-64 shrink-0 flex flex-col min-h-0 bg-[#0b0b0e]">
          
          {/* Results Tab Bar */}
          <div className="h-9 border-b border-white/[0.06] px-4 flex items-center justify-between text-xs text-white/40 select-none">
            <span className="font-medium text-white/60">Results Log</span>
            {results && !results.error && (
              <div className="flex items-center gap-3 font-mono text-[10px]">
                <span>{results.affectedRows} rows returned</span>
                <span>•</span>
                <span>{results.duration}ms</span>
              </div>
            )}
          </div>

          {/* Results Output Screen */}
          <div className="flex-grow overflow-auto p-4 font-mono text-xs">
            {isRunning ? (
              <div className="flex items-center gap-2 text-white/40 py-4 select-none">
                <RefreshCw className="w-4 h-4 animate-spin text-accent" />
                <span>Running database transactions...</span>
              </div>
            ) : !results ? (
              <div className="flex items-center gap-2 text-white/20 py-4 select-none">
                <Terminal className="w-4 h-4" />
                <span>Console ready. Press Run to execute custom SQL queries.</span>
              </div>
            ) : results.error ? (
              <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-3 text-red-400 space-y-1 select-text">
                <div className="font-semibold font-sans">Database Query Execution Error:</div>
                <div className="text-[11px] leading-relaxed">{results.error}</div>
              </div>
            ) : results.rows.length === 0 ? (
              <div className="border border-white/[0.06] bg-white/[0.01] rounded-lg p-3 text-white/50 select-none">
                Query returned successfully. No rows affected. ({results.duration}ms)
              </div>
            ) : (
              <div className="overflow-x-auto border border-white/[0.06] rounded-lg bg-[#070709] max-h-48">
                <table className="w-full border-collapse font-mono text-[11px] text-left">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.02] text-white/40 font-semibold whitespace-nowrap">
                      {results.headers.map(header => (
                        <th key={header} className="px-3 py-2 border-r border-white/[0.04] last:border-r-0">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {results.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-white/[0.01] transition-colors whitespace-nowrap">
                        {results.headers.map(header => {
                          const val = row[header]
                          const displayVal = val === null ? 'NULL' : typeof val === 'object' ? JSON.stringify(val) : String(val)
                          return (
                            <td key={header} className="px-3 py-2 border-r border-white/[0.03] last:border-r-0 text-white/80 max-w-xs truncate" title={displayVal}>
                              {val === null ? <span className="text-white/25 italic">NULL</span> : displayVal}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

      </main>

    </div>
  )
}
