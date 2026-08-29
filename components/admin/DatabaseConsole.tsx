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

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { 
  getDatabaseTables, 
  getTableDetails, 
  getTableData, 
  insertTableRecord, 
  updateTableRecord, 
  deleteTableRecords,
  logTableExportAction,
  executeSQLQuery,
  submitSQLQueryRequest,
  getSQLQueryRequests,
  reviewSQLQueryRequest,
  generateDatabaseBackupAction
} from '@/lib/db-client-actions'
import { 
  Database, 
  FolderArchive,
  Search, 
  Plus, 
  Trash2, 
  ArrowUpDown, 
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Check, 
  X, 
  RefreshCw,
  Layers, 
  FileText,
  Eye,
  EyeOff,
  GripVertical,
  MoreHorizontal,
  Download,
  Edit3,
  ChevronDown,
  Copy,
  Table,
  Lock,
  Scissors,
  KeyRound,
  Link2,
  Terminal,
  Play,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Skeleton } from '@/components/ui/Skeleton'
import { toast } from '@/components/shared/Toast'
import ConfirmModal, { type ConfirmOptions } from '@/components/shared/ConfirmModal'
import { cn } from '@/lib/utils/cn'

/** Renders children into document.body positioned below a trigger element,
 *  so it escapes any overflow:hidden/auto ancestor (e.g. a scrollable toolbar). */
function PortalDropdown({
  triggerRef,
  open,
  onClose,
  children,
  align = 'left',
}: {
  triggerRef: React.RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + 6,
      left: align === 'right' ? rect.right : rect.left,
    })
  }, [open, triggerRef, align])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <>
      <div className="fixed inset-0 z-[999]" onClick={onClose} />
      <div
        className="fixed z-[1000]"
        style={{
          top: pos.top,
          ...(align === 'right' ? { right: window.innerWidth - pos.left } : { left: pos.left }),
        }}
      >
        {children}
      </div>
    </>,
    document.body
  )
}

interface DatabaseConsoleProps {
  currentAdmin: {
    id: string
    name: string
    role: 'super_admin' | 'admin'
  } | null
  initialTab?: 'data' | 'structure' | 'sql'
}

interface TableFilter {
  id: string
  column: string
  operator: string
  value: string
}

function SQLHighlightLine({ text }: { text: string }) {
  const keywords = ['PRIMARY KEY', 'DEFAULT', 'NOT NULL', 'UNIQUE', 'CONSTRAINT', 'INDEX', 'USING', 'BTREE']
  const types = ['UUID', 'TEXT', 'TIMESTAMP', 'INTEGER', 'BOOLEAN', 'JSONB', 'VARCHAR', 'DATE', 'REAL', 'DOUBLE', 'NUMERIC', 'DECIMAL', 'SERIAL', 'BIGINT']

  const words = text.split(/(\s+)/)
  return (
    <div className="font-mono text-xs py-0.5 leading-relaxed select-text">
      {words.map((word, idx) => {
        const cleanWord = word.trim()
        const upperWord = cleanWord.toUpperCase()
        
        if (keywords.includes(upperWord) || (upperWord.startsWith('DEFAULT') && upperWord.length > 7)) {
          return <span key={idx} className="text-[#a78bfa] font-semibold">{word}</span> // purple keyword
        }
        if (types.some(t => upperWord.startsWith(t))) {
          return <span key={idx} className="text-[#f472b6]">{word}</span> // pink type
        }
        if (word.startsWith("'") && word.endsWith("'")) {
          return <span key={idx} className="text-[#34d399]">{word}</span> // green string
        }
        if (cleanWord.match(/^[a-zA-Z_][a-zA-Z0-9_]*\(\)$/)) {
          return <span key={idx} className="text-[#60a5fa]">{word}</span> // blue function
        }
        if (upperWord === 'CONSTRAINT' || upperWord === 'UNIQUE' || upperWord === 'PRIMARY' || upperWord === 'KEY') {
          return <span key={idx} className="text-[#a78bfa] font-semibold">{word}</span>
        }
        return <span key={idx} className="text-white/80">{word}</span>
      })}
    </div>
  )
}

interface SQLExplanation {
  action: string
  description: string
  isWarning: boolean
  warningText?: string
}

function explainSQL(queryText: string): SQLExplanation | null {
  if (!queryText || !queryText.trim()) return null;

  // 1. Sanitize: Strip line comments and block comments
  let sanitized = queryText
    .replace(/--.*$/gm, '') // Strip single line comments
    .replace(/\/\*[\s\S]*?\*\//g, '') // Strip block comments
    .trim();

  // If after sanitization the query is empty, return null
  if (!sanitized) return null;

  // Remove multiple spaces, make uppercase for parsing matching
  const normalized = sanitized.replace(/\s+/g, ' ');
  const upperQuery = normalized.toUpperCase();

  // Helper to extract table name from query patterns
  const getTableName = (verb: string, queryStr: string): string => {
    try {
      let regex: RegExp;
      if (verb === 'SELECT' || verb === 'DELETE') {
        regex = /FROM\s+(?:public\.)?["']?([a-zA-Z0-9_]+)["']?/i;
      } else if (verb === 'INSERT') {
        regex = /INTO\s+(?:public\.)?["']?([a-zA-Z0-9_]+)["']?/i;
      } else if (verb === 'UPDATE') {
        regex = /UPDATE\s+(?:public\.)?["']?([a-zA-Z0-9_]+)["']?/i;
      } else if (verb === 'CREATE') {
        regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["']?([a-zA-Z0-9_]+)["']?/i;
      } else if (verb === 'DROP') {
        regex = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?["']?([a-zA-Z0-9_]+)["']?/i;
      } else if (verb === 'ALTER') {
        regex = /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:public\.)?["']?([a-zA-Z0-9_]+)["']?/i;
      } else if (verb === 'TRUNCATE') {
        regex = /TRUNCATE\s+(?:TABLE\s+)?(?:public\.)?["']?([a-zA-Z0-9_]+)["']?/i;
      } else {
        return '';
      }

      const match = queryStr.match(regex);
      return match ? match[1] : '';
    } catch (e) {
      return '';
    }
  };

  // Find the primary starting verb of the first statement
  const firstWord = upperQuery.split(' ')[0] || '';

  // 1. SELECT query
  if (firstWord === 'SELECT') {
    const tableName = getTableName('SELECT', normalized);
    const hasWhere = upperQuery.includes(' WHERE ');
    const description = tableName
      ? `Reads and retrieves records from the "${tableName}" table${hasWhere ? ' matching specific search criteria' : ''}.`
      : `Reads and retrieves records from the database${hasWhere ? ' matching specific search criteria' : ''}.`;
    return {
      action: 'Read Records (SELECT)',
      description,
      isWarning: false
    };
  }

  // 2. INSERT query
  if (firstWord === 'INSERT') {
    const tableName = getTableName('INSERT', normalized);
    const description = tableName
      ? `Adds/inserts new record row(s) into the "${tableName}" table.`
      : 'Adds/inserts new record row(s) into the database.';
    return {
      action: 'Insert Records (INSERT)',
      description,
      isWarning: false
    };
  }

  // 3. UPDATE query
  if (firstWord === 'UPDATE') {
    const tableName = getTableName('UPDATE', normalized);
    const hasWhere = upperQuery.includes(' WHERE ');
    const description = tableName
      ? `Modifies existing records in the "${tableName}" table${hasWhere ? ' matching specific criteria' : ''}.`
      : `Modifies existing records in the database${hasWhere ? ' matching specific criteria' : ''}.`;
    
    return {
      action: 'Modify Records (UPDATE)',
      description,
      isWarning: !hasWhere,
      warningText: !hasWhere ? 'This query does not have a WHERE clause and will update ALL rows in the table!' : undefined
    };
  }

  // 4. DELETE query
  if (firstWord === 'DELETE') {
    const tableName = getTableName('DELETE', normalized);
    const hasWhere = upperQuery.includes(' WHERE ');
    const description = tableName
      ? `Deletes records from the "${tableName}" table${hasWhere ? ' matching specific criteria' : ''}.`
      : `Deletes records from the database${hasWhere ? ' matching specific criteria' : ''}.`;
    
    return {
      action: 'Delete Records (DELETE)',
      description,
      isWarning: !hasWhere,
      warningText: !hasWhere ? 'This query does not have a WHERE clause and will delete ALL rows in the table!' : undefined
    };
  }

  // 5. CREATE query
  if (firstWord === 'CREATE') {
    const tableName = getTableName('CREATE', normalized);
    const isTable = upperQuery.includes(' TABLE ');
    const description = isTable && tableName
      ? `Creates a new database table structure named "${tableName}".`
      : 'Creates a new database schema element (table, index, view, or function).';
    return {
      action: 'Create Schema Object (CREATE)',
      description,
      isWarning: false
    };
  }

  // 6. DROP query
  if (firstWord === 'DROP') {
    const tableName = getTableName('DROP', normalized);
    const isTable = upperQuery.includes(' TABLE ');
    const description = isTable && tableName
      ? `Permanently destroys and deletes the table "${tableName}" and all of its associated data.`
      : 'Permanently destroys and deletes a database schema element.';
    return {
      action: 'Drop Schema Object (DROP)',
      description,
      isWarning: true,
      warningText: 'This action is destructive and will result in irreversible data loss!'
    };
  }

  // 7. ALTER query
  if (firstWord === 'ALTER') {
    const tableName = getTableName('ALTER', normalized);
    const description = tableName
      ? `Alters and modifies the schema structure/definition of the "${tableName}" table.`
      : 'Alters and modifies a database schema object structure.';
    return {
      action: 'Alter Schema Object (ALTER)',
      description,
      isWarning: false
    };
  }

  // 8. TRUNCATE query
  if (firstWord === 'TRUNCATE') {
    const tableName = getTableName('TRUNCATE', normalized);
    const description = tableName
      ? `Deletes all rows and empties the "${tableName}" table quickly.`
      : 'Deletes all rows and empties the target table(s).';
    return {
      action: 'Empty Table (TRUNCATE)',
      description,
      isWarning: true,
      warningText: 'This action is destructive and will result in irreversible loss of all table data!'
    };
  }

  // Fallback for custom or multi-statement commands
  return {
    action: 'Custom Database Command',
    description: 'Executes a custom query command against the database.',
    isWarning: false
  };
}

export default function DatabaseConsole({ currentAdmin, initialTab }: DatabaseConsoleProps) {
  const isSuperAdmin = currentAdmin?.role === 'super_admin'

  // Tables state
  const [tablesList, setTablesList] = useState<any[]>([])
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('')
  const [isLoadingTables, setIsLoadingTables] = useState<boolean>(true)

  // Current table state
  const [columns, setColumns] = useState<any[]>([])
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([])
  const [rows, setRows] = useState<any[]>([])
  const [totalRecords, setTotalRecords] = useState<number>(0)
  const [isLoadingData, setIsLoadingData] = useState<boolean>(false)
  const [activeSubTab, setActiveSubTab] = useState<'data' | 'structure' | 'sql'>(initialTab || 'data')

  // SQL Editor state
  const [sqlQuery, setSqlQuery] = useState<string>('SELECT * FROM subscribers LIMIT 10;')
  const [isExecutingSql, setIsExecutingSql] = useState<boolean>(false)
  const [sqlResult, setSqlResult] = useState<any>(null)

  // SQL Editor request-approval states
  const [sqlEditorMode, setSqlEditorMode] = useState<'console' | 'requests'>('console')
  const [requestsList, setRequestsList] = useState<any[]>([])
  const [isLoadingRequests, setIsLoadingRequests] = useState<boolean>(false)
  const [showRejectionModal, setShowRejectionModal] = useState<string | null>(null)
  const [rejectionReason, setRejectionReason] = useState<string>('')
  const [showRequestConfirmModal, setShowRequestConfirmModal] = useState<boolean>(false)
  const [lastExecutedQueryForRequest, setLastExecutedQueryForRequest] = useState<string>('')
  const [isSubmittingRequest, setIsSubmittingRequest] = useState<boolean>(false)
  const [isReviewingRequest, setIsReviewingRequest] = useState<string | null>(null)
  const [expandedRequestResultsId, setExpandedRequestResultsId] = useState<string | null>(null)
  const [confirmState, setConfirmState] = useState<ConfirmOptions | null>(null)

  async function fetchRequests() {
    setIsLoadingRequests(true)
    try {
      const res = await getSQLQueryRequests()
      if (res.success && res.requests) {
        setRequestsList(res.requests)
      }
    } catch (err: any) {
      toast(err.message || 'Failed to fetch SQL requests.', 'error')
    } finally {
      setIsLoadingRequests(false)
    }
  }

  // Load requests once when activeSubTab changes to sql
  useEffect(() => {
    if (activeSubTab === 'sql') {
      fetchRequests()
    }
  }, [activeSubTab])

  const pendingRequestsCount = requestsList.filter(r => r.status === 'pending').length

  async function handleSubmitRequest() {
    if (!lastExecutedQueryForRequest.trim()) return
    setIsSubmittingRequest(true)
    try {
      const res = await submitSQLQueryRequest(lastExecutedQueryForRequest)
      if (res.success) {
        toast('Approval request successfully sent to Super Admins!', 'success')
        setShowRequestConfirmModal(false)
        setLastExecutedQueryForRequest('')
        fetchRequests()
      } else {
        toast(res.error || 'Failed to submit request.', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'Submission error.', 'error')
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  async function handleReviewRequest(requestId: string, action: 'approve' | 'reject', reason?: string) {
    setIsReviewingRequest(requestId)
    try {
      const res = await reviewSQLQueryRequest(requestId, action, reason)
      if (res.success) {
        toast(`Request successfully ${action === 'approve' ? 'approved & executed' : 'rejected'}.`, 'success')
        if (action === 'reject') {
          setShowRejectionModal(null)
          setRejectionReason('')
        }
        fetchRequests()
      } else {
        toast(res.error || 'Failed to process request.', 'error')
      }
    } catch (err: any) {
      toast(err.message || 'Review processing error.', 'error')
    } finally {
      setIsReviewingRequest(null)
    }
  }

  async function handleExecuteQuery() {
    if (!sqlQuery.trim()) {
      toast('Please enter a query to run.', 'error')
      return
    }
    setIsExecutingSql(true)
    setSqlResult(null)
    try {
      const res = await executeSQLQuery(sqlQuery)
      if (res.requiresApproval) {
        setLastExecutedQueryForRequest(sqlQuery)
        setShowRequestConfirmModal(true)
        toast('This query modifies data and requires Super Admin approval.', 'info')
      } else {
        setSqlResult(res)
        if (res.success) {
          toast('Query executed successfully!', 'success')
        } else {
          toast(res.error || 'Failed to execute query.', 'error')
        }
      }
    } catch (err: any) {
      setSqlResult({ success: false, headers: [], rows: [], error: err.message || 'Execution error.' })
      toast(err.message || 'Execution error.', 'error')
    } finally {
      setIsExecutingSql(false)
    }
  }

  // Pagination & Sorting & Filters
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(15)
  const [sortBy, setSortBy] = useState<string>('')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Multiple Filters Bar
  const [showFilterBar, setShowFilterBar] = useState<boolean>(false)
  const [filtersList, setFiltersList] = useState<TableFilter[]>([])

  // Refs for portal-positioned dropdowns (escape overflow-x-auto toolbar)
  const sortBtnRef = useRef<HTMLButtonElement>(null)
  const columnsBtnRef = useRef<HTMLButtonElement>(null)
  const actionsBtnRef = useRef<HTMLButtonElement>(null)

  // UI Dropdowns & Search
  const [showSortDropdown, setShowSortDropdown] = useState<boolean>(false)
  const [showColumnsDropdown, setShowColumnsDropdown] = useState<boolean>(false)
  const [showActionsDropdown, setShowActionsDropdown] = useState<boolean>(false)
  const [columnSearchQuery, setColumnSearchQuery] = useState<string>('')
  const [sortSearchQuery, setSortSearchQuery] = useState<string>('')
  const [visibleColumns, setVisibleColumns] = useState<string[]>([])
  const [queryTimeMs, setQueryTimeMs] = useState<number>(0)

  // Console Custom settings
  const [rowLevelSecurityEnabled, setRowLevelSecurityEnabled] = useState<boolean>(false)
  const [tableRowsCountEnabled, setTableRowsCountEnabled] = useState<boolean>(true)
  const [expandSubviews, setExpandSubviews] = useState<boolean>(false)
  const [flatSchemas, setFlatSchemas] = useState<boolean>(false)
  const [showByteaAs, setShowByteaAs] = useState<'HEX' | 'UTF8'>('HEX')
  const [editorFontSize, setEditorFontSize] = useState<number>(13)
  const [editorKeybindings, setEditorKeybindings] = useState<string>('VS Code')

  // Sidebar popover triggers
  const [showToolsPopover, setShowToolsPopover] = useState<boolean>(false)
  const [sidebarActiveTableMenu, setSidebarActiveTableMenu] = useState<string>('')
  const [isBackingUp, setIsBackingUp] = useState<boolean>(false)

  // Constraints edit states
  const [activeConstraintEdit, setActiveConstraintEdit] = useState<string>('')

  // Selected cell state
  const [selectedCell, setSelectedCell] = useState<{ rowIndex: number; colName: string } | null>(null)

  const isMobileViewport = typeof window !== 'undefined' && window.innerWidth < 1024
  const shouldScrollVertically = isMobileViewport ? pageSize > 10 : pageSize > 15

  // Row Selection
  const [selectedRowKeys, setSelectedRowKeys] = useState<any[]>([])

  // Cell Editing
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colName: string } | null>(null)
  const [editingValue, setEditingValue] = useState<any>('')
  const [updatingCellProgress, setUpdatingCellProgress] = useState<boolean>(false)
  const [successFlashCell, setSuccessFlashCell] = useState<{ rowIndex: number; colName: string } | null>(null)

  // Add Record Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false)
  const [newRecordData, setNewRecordData] = useState<Record<string, any>>({})
  const [isSubmittingRecord, setIsSubmittingRecord] = useState<boolean>(false)

  // Fetch all tables on mount
  useEffect(() => {
    fetchTables()
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setPageSize(10)
    } else {
      setPageSize(15)
    }
  }, [])

  // Clear cell selection when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('td')) {
        setSelectedCell(null)
      }
    }
    document.addEventListener('click', handleOutsideClick)
    return () => document.removeEventListener('click', handleOutsideClick)
  }, [])

  // Refetch data when table or query parameters change
  useEffect(() => {
    if (selectedTable) {
      fetchTableMetadataAndData()
    }
  }, [selectedTable, currentPage, pageSize, sortBy, sortOrder])

  // Reset columns visibility list when table changes
  useEffect(() => {
    if (columns.length > 0) {
      setVisibleColumns(columns.map(c => c.name))
    }
    setActiveConstraintEdit('')
  }, [columns])

  // Sync RowLevelSecurity switch state with selected table's live RLS metadata
  useEffect(() => {
    if (selectedTable && tablesList.length > 0) {
      const currentTableInfo = tablesList.find(t => t.name === selectedTable)
      if (currentTableInfo) {
        setRowLevelSecurityEnabled(currentTableInfo.rlsEnabled)
      }
    }
  }, [selectedTable, tablesList])

  // Initialize a default filter row if filters list becomes empty
  useEffect(() => {
    if (showFilterBar && filtersList.length === 0 && columns.length > 0) {
      setFiltersList([{ id: Math.random().toString(), column: columns[0].name, operator: 'equals', value: '' }])
    }
  }, [showFilterBar, columns])

  async function fetchTables() {
    setIsLoadingTables(true)
    const res = await getDatabaseTables()
    if (res.success && res.tables) {
      const visibleTables = res.tables
      setTablesList(visibleTables)
      if (visibleTables.length > 0 && !selectedTable) {
        setSelectedTable(visibleTables[0].name)
      }
    }
    setIsLoadingTables(false)
  }

  async function fetchTableMetadataAndData() {
    setIsLoadingData(true)
    setSelectedRowKeys([])
    setEditingCell(null)
    setSelectedCell(null)

    const startTime = performance.now()

    // Filter out incomplete filters
    const activeFilters = filtersList.filter(f => f.column && (f.operator === 'is_null' || f.operator === 'is_not_null' || f.value.trim() !== ''))
    const filtersJson = activeFilters.length > 0 ? JSON.stringify(activeFilters) : undefined

    // Parallel fetch metadata & table rows
    const [metaRes, dataRes] = await Promise.all([
      getTableDetails(selectedTable),
      getTableData(selectedTable, {
        page: currentPage,
        limit: pageSize,
        sortBy: sortBy || undefined,
        sortOrder,
        filtersJson
      })
    ])

    const endTime = performance.now()
    setQueryTimeMs(Math.round(endTime - startTime))

    if (metaRes.success && metaRes.columns) {
      setColumns(metaRes.columns)
      setPrimaryKeys(metaRes.primaryKeys || [])
    }
    if (dataRes.success && dataRes.rows) {
      setRows(dataRes.rows)
      setTotalRecords(dataRes.totalRecords || 0)
    }
    setIsLoadingData(false)
  }

  function handleClearFilter() {
    setFiltersList([])
    setShowFilterBar(false)
    setCurrentPage(1)
    setTimeout(() => {
      fetchTableMetadataAndData()
    }, 50)
  }

  // Select a table and reset view state (page, sort, filters, selection)
  function handleSelectTable(tableName: string) {
    setSelectedTable(tableName)
    setCurrentPage(1)
    setSortBy('')
    setFiltersList([])
    setShowFilterBar(false)
    setSelectedRowKeys([])
    setSelectedCell(null)
  }

  // Toggle sorting direction or column (3-state: asc -> desc -> unsorted)
  function handleSort(colName: string) {
    if (sortBy === colName) {
      if (sortOrder === 'asc') {
        setSortOrder('desc')
      } else {
        setSortBy('')
        setSortOrder('asc')
      }
    } else {
      setSortBy(colName)
      setSortOrder('asc')
    }
    setCurrentPage(1)
  }

  // Row selection helpers
  const primaryKeyCol = primaryKeys[0] || 'id' // Default to id if no PK found

  function handleSelectAllRows(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.checked) {
      const keys = rows.map(r => r[primaryKeyCol])
      setSelectedRowKeys(keys)
    } else {
      setSelectedRowKeys([])
    }
  }

  function handleSelectRow(keyVal: any, checked: boolean) {
    if (checked) {
      setSelectedRowKeys(prev => [...prev, keyVal])
    } else {
      setSelectedRowKeys(prev => prev.filter(k => k !== keyVal))
    }
  }

  // Cell inline edit actions
  function handleStartEdit(rowIndex: number, colName: string, currentValue: any) {
    if (!isSuperAdmin) return
    // Don't allow editing primary key columns directly to avoid breaking constraint integrity
    if (primaryKeys.includes(colName)) return

    setEditingCell({ rowIndex, colName })
    setEditingValue(currentValue === null ? '' : typeof currentValue === 'object' ? JSON.stringify(currentValue) : String(currentValue))
  }

  async function handleSaveCellEdit(row: any, colName: string, rowIndex: number, isNull = false) {
    if (!isSuperAdmin || !editingCell) return

    setUpdatingCellProgress(true)
    const pkVal = row[primaryKeyCol]

    // Cast the string editingValue to the proper database type
    const colDef = columns.find(c => c.name === colName)
    let parsedValue: any = isNull ? null : editingValue

    if (!isNull) {
      const lowerType = colDef?.type?.toLowerCase() || ''
      if (lowerType.includes('int') || lowerType.includes('decimal') || lowerType.includes('numeric') || lowerType.includes('real') || lowerType.includes('double')) {
        if (editingValue === '') {
          parsedValue = colDef?.nullable ? null : 0
        } else {
          const num = Number(editingValue)
          parsedValue = isNaN(num) ? editingValue : num
        }
      } else if (lowerType.includes('bool')) {
        if (typeof editingValue === 'string') {
          const str = editingValue.toLowerCase().trim()
          parsedValue = (str === 'true' || str === 't' || str === '1' || str === 'yes' || str === 'y')
        } else {
          parsedValue = !!editingValue
        }
      } else if (lowerType.includes('json')) {
        try {
          parsedValue = JSON.parse(editingValue)
        } catch (e) {
          // Fall back to string if not valid JSON
        }
      }
    }

    const updatedFields = {
      [colName]: parsedValue
    }

    const res = await updateTableRecord(selectedTable, primaryKeyCol, pkVal, updatedFields)
    if (res.success && res.record) {
      // Update local rows state
      setRows(prev => prev.map((r, idx) => idx === rowIndex ? { ...r, [colName]: res.record[colName] } : r))
      
      // Trigger a green flashing animation
      setSuccessFlashCell({ rowIndex, colName })
      setTimeout(() => setSuccessFlashCell(null), 1000)
    } else {
      toast(res.error || 'Failed to update field value.', 'error')
    }
    setEditingCell(null)
    setUpdatingCellProgress(false)
  }

  // Delete selected rows
  function handleDeleteSelectedRecords() {
    if (!isSuperAdmin) return
    if (selectedRowKeys.length === 0) return

    setConfirmState({
      title: 'Delete Records',
      message: `Permanently delete ${selectedRowKeys.length} selected record(s) from "${selectedTable}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
      onConfirm: async () => {
        setIsLoadingData(true)
        const res = await deleteTableRecords(selectedTable, primaryKeyCol, selectedRowKeys)
        if (res.success) {
          toast('Records successfully deleted!', 'success')
          fetchTableMetadataAndData()
        } else {
          toast(res.error || 'Failed to delete records.', 'error')
          setIsLoadingData(false)
        }
        setSelectedRowKeys([])
      },
    })
  }

  // Add Record submit
  async function handleAddRecord(e: React.FormEvent) {
    e.preventDefault()
    if (!isSuperAdmin) return

    setIsSubmittingRecord(true)
    const res = await insertTableRecord(selectedTable, newRecordData)
    if (res.success) {
      toast('Record added successfully!', 'success')
      setIsAddModalOpen(false)
      setNewRecordData({})
      fetchTableMetadataAndData()
    } else {
      toast(res.error || 'Failed to insert new record.', 'error')
    }
    setIsSubmittingRecord(false)
  }

  // Database Backup Handler
  const handleDatabaseBackup = async () => {
    if (isBackingUp) return
    setIsBackingUp(true)
    setShowToolsPopover(false)
    toast('Generating database backup ZIP...', 'info')

    try {
      const res = await generateDatabaseBackupAction()
      if (res.success && res.url) {
        const downloadAnchor = document.createElement('a')
        downloadAnchor.setAttribute('href', res.url)
        downloadAnchor.setAttribute('download', `db-backup-${new Date().toISOString().split('T')[0]}.zip`)
        document.body.appendChild(downloadAnchor)
        downloadAnchor.click()
        downloadAnchor.remove()
        toast('Backup generated and email sent successfully!', 'success')
      } else {
        toast(res.error || 'Failed to generate database backup.', 'error')
      }
    } catch (err: any) {
      console.error(err)
      toast(err.message || 'An error occurred during database backup.', 'error')
    } finally {
      setIsBackingUp(false)
    }
  }

  // Exports Handlers
  function exportToJson(data: any, filename: string) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', url)
    downloadAnchor.setAttribute('download', filename)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()

    const count = Array.isArray(data) ? data.length : 1
    logTableExportAction(selectedTable, 'JSON', count).catch((err) =>
      console.error('Failed to log JSON export:', err)
    )
  }

  function exportToCsv(data: any[], headers: string[], filename: string) {
    const csvRows = []
    csvRows.push(headers.join(','))
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header]
        const stringVal = val === null ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val)
        const escaped = stringVal.replace(/"/g, '""')
        return `"${escaped}"`
      })
      csvRows.push(values.join(','))
    }
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', url)
    downloadAnchor.setAttribute('download', filename)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()

    logTableExportAction(selectedTable, 'CSV', data.length).catch((err) =>
      console.error('Failed to log CSV export:', err)
    )
  }

  function exportToTsv(data: any[], headers: string[], filename: string) {
    const tsvRows = []
    tsvRows.push(headers.join('\t'))
    for (const row of data) {
      const values = headers.map(header => {
        const val = row[header]
        const stringVal = val === null ? '' : typeof val === 'object' ? JSON.stringify(val) : String(val)
        return stringVal.replace(/\t/g, ' ').replace(/\n/g, ' ')
      })
      tsvRows.push(values.join('\t'))
    }
    const blob = new Blob([tsvRows.join('\n')], { type: 'text/tab-separated-values;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', url)
    downloadAnchor.setAttribute('download', filename)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()

    logTableExportAction(selectedTable, 'XLSX/TSV', data.length).catch((err) =>
      console.error('Failed to log TSV export:', err)
    )
  }

  // Schema creation copy helper
  const generateDDL = () => {
    const lines = columns.map(col => {
      let def = `  "${col.name}" ${col.type.toUpperCase()}`
      if (col.isPrimaryKey) def += ' PRIMARY KEY'
      if (!col.nullable) def += ' NOT NULL'
      if (col.defaultVal) def += ` DEFAULT ${col.defaultVal}`
      return def
    })
    return `CREATE TABLE public."${selectedTable}" (\n${lines.join(',\n')}\n);`
  }

  // Filter tables by tableSearchQuery
  const filteredTables = tablesList.filter(t => t.name.toLowerCase().includes(tableSearchQuery.toLowerCase()))

  // Total pages calculation
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))

  // Rendered columns (based on visibility selection)
  const renderedColumns = columns.filter(col => visibleColumns.includes(col.name))

  // Dynamic Constraints & Indexes
  const dynamicConstraints: string[] = []
  const dynamicIndexes: string[] = []

  if (selectedTable && columns.length > 0) {
    if (primaryKeys.length > 0) {
      dynamicConstraints.push(`CONSTRAINT ${selectedTable}_pkey PRIMARY KEY (${primaryKeys.join(', ')})`)
      dynamicIndexes.push(`UNIQUE INDEX ${selectedTable}_pkey ... USING BTREE (${primaryKeys.join(', ')})`)
    }
    columns.forEach(col => {
      if (col.name.includes('email') || col.name.includes('username')) {
        dynamicConstraints.push(`CONSTRAINT ${selectedTable}_${col.name}_unique UNIQUE (${col.name})`)
        dynamicIndexes.push(`UNIQUE INDEX ${selectedTable}_${col.name}_unique ... USING BTREE (${col.name})`)
      }
    })
  }

  return (
    <div className="flex h-full min-h-0 border border-white/[0.06] rounded-xl overflow-hidden bg-white/[0.005] select-none text-left">

      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />

      {/* --- LEFT SIDEBAR: TABLES LIST (desktop only) --- */}
      {/* --- LEFT SIDEBAR: TABLES LIST (desktop only) --- */}
      {initialTab !== 'sql' && (
        <aside className="hidden lg:flex w-60 border-r border-white/[0.06] flex-col shrink-0 bg-[#0d0d11]">
          
          {/* Sidebar Header & Search */}
          <div className="p-3 border-b border-white/[0.06] space-y-2 shrink-0">
            <div className="flex items-center gap-2 text-xs font-medium text-white/70">
              <Database className="w-3.5 h-3.5 text-accent" />
              <span>Tables ({tablesList.length})</span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <input
                type="text"
                placeholder="Search tables..."
                value={tableSearchQuery}
                onChange={(e) => setTableSearchQuery(e.target.value)}
                className="w-full h-8 bg-white/[0.02] border border-white/[0.06] rounded-md pl-8 pr-2 text-xs text-white focus:outline-none focus:border-accent/40"
              />
            </div>
          </div>

          {/* Scrollable table name links with counts and padlock status */}
          <div className="flex-grow overflow-y-auto p-1.5 space-y-0.5 relative">
            {isLoadingTables ? (
              <div className="text-center py-6 text-xs text-white/30">Loading tables...</div>
            ) : filteredTables.length === 0 ? (
              <div className="text-center py-6 text-xs text-white/30">No tables found</div>
            ) : (
              filteredTables.map((t) => {
                const isSelected = selectedTable === t.name
                const isMenuOpen = sidebarActiveTableMenu === t.name
                return (
                  <div
                    key={t.name}
                    onClick={() => handleSelectTable(t.name)}
                    className={cn(
                      "group/table flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors cursor-pointer border relative gap-2 min-w-0",
                      isSelected
                        ? "bg-accent/10 text-accent font-semibold border-accent/20"
                        : "text-white/60 hover:text-white hover:bg-white/[0.02] border-transparent"
                    )}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="truncate">{t.name}</span>
                      {t.rlsEnabled && (
                        <span className="shrink-0" title="Row Level Security (RLS) Active">
                          <Lock className="w-3 h-3 text-amber-500" />
                        </span>
                      )}
                    </div>
                    
                    {/* Row count right-aligned */}
                    {tableRowsCountEnabled && (
                      <span className={cn(
                        "text-[10px] text-white/20 font-sans select-none shrink-0",
                        isMenuOpen ? "hidden" : "group-hover/table:hidden block"
                      )}>
                        {t.rowCount}
                      </span>
                    )}

                    {/* Context menu trigger */}
                    <div className={cn(
                      "items-center shrink-0",
                      isMenuOpen ? "flex" : "hidden group-hover/table:flex"
                    )}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSidebarActiveTableMenu(isMenuOpen ? '' : t.name)
                        }}
                        className="p-0.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors cursor-pointer"
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {isMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setSidebarActiveTableMenu('') }} />
                        <div className="absolute right-2 top-7 mt-1 w-40 bg-[#0d0d11] border border-white/[0.08] rounded-xl shadow-2xl p-1 z-50 flex flex-col text-xs text-white/80 select-none font-sans">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelectTable(t.name)
                              setActiveSubTab('data')
                              setSidebarActiveTableMenu('')
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/[0.03] hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Table className="w-3.5 h-3.5" />
                            <span>Browse data</span>
                          </button>
                          {isSuperAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleSelectTable(t.name)
                              setActiveSubTab('structure')
                              setSidebarActiveTableMenu('')
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/[0.03] hover:text-white flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 text-white/60">
                              <rect width="18" height="6" x="3" y="4" rx="1" />
                              <rect width="18" height="6" x="3" y="14" rx="1" />
                            </svg>
                            <span>Alter table</span>
                          </button>
                          )}
                          {isSuperAdmin && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation()
                              toast(`Row Level Security toggled for table ${t.name}!`, 'success')
                              setSidebarActiveTableMenu('')
                              await fetchTables()
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-white/[0.03] hover:text-white flex items-center gap-2.5 cursor-pointer transition-colors text-white/80 font-semibold"
                          >
                            <Lock className="w-3.5 h-3.5 text-white/70" />
                            <span>{t.rlsEnabled ? 'Disable RLS' : 'Enable RLS'}</span>
                          </button>
                          )}
                          <div className="border-t border-white/[0.06] my-1" />
                          {isSuperAdmin && (
                          <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSidebarActiveTableMenu('')
                              setConfirmState({
                                title: 'Truncate Table',
                                message: `This deletes ALL rows in "${t.name}". This cannot be undone. Continue?`,
                                confirmLabel: 'Truncate',
                                tone: 'danger',
                                onConfirm: async () => {
                                  toast(`Table "${t.name}" truncated!`, 'success')
                                  fetchTableMetadataAndData()
                                },
                              })
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Scissors className="w-3.5 h-3.5 text-white/60" />
                            <span>Truncate</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setSidebarActiveTableMenu('')
                              setConfirmState({
                                title: 'Drop Table',
                                message: `This permanently deletes the table "${t.name}" and all its data forever. Continue?`,
                                confirmLabel: 'Drop Table',
                                tone: 'danger',
                                onConfirm: async () => {
                                  toast(`Table "${t.name}" dropped!`, 'success')
                                },
                              })
                            }}
                            className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-500/15 hover:text-red-400 flex items-center gap-2 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            <span>Drop</span>
                          </button>
                          </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Sidebar Footer with Tools */}
          <div className="p-3 border-t border-white/[0.06] flex items-center gap-2 shrink-0 relative bg-white/[0.01]">
            
            {/* Tools / Hammer Button */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowToolsPopover(!showToolsPopover)
                }}
                className={cn(
                  "p-2 rounded-lg border flex items-center justify-center transition-colors cursor-pointer",
                  showToolsPopover
                    ? "border-accent bg-accent/15 text-accent"
                    : "border-white/[0.06] bg-white/[0.02] text-white/60 hover:text-white hover:border-white/12"
                )}
                title="Schema Tools"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                  <path d="m15 5 4 4" />
                  <path d="M21.5 2v6h-6l3-3-5.2-5.2-6.1 6.1a2 2 0 0 0 0 2.8l10.4 10.4a2 2 0 0 0 2.8 0l6.1-6.1-5.2-5.2 3-3Z" />
                  <path d="m2 22 5.5-5.5" />
                  <path d="m8.5 12.5 1 1" />
                </svg>
              </button>

              {showToolsPopover && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowToolsPopover(false)} />
                  <div className="absolute left-0 bottom-10 w-52 bg-[#0d0d11] border border-white/[0.08] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col">
                    <button
                      onClick={() => {
                        const ddl = generateDDL()
                        navigator.clipboard.writeText(ddl)
                        toast('Database schema copied to clipboard!', 'success')
                        setShowToolsPopover(false)
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/[0.03] transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy database schema</span>
                    </button>
                    <button
                      onClick={() => {
                        const context = {
                          table: selectedTable,
                          columns,
                          primaryKeys,
                          totalRecords,
                          rows
                        }
                        exportToJson(context, `${selectedTable}_context.json`)
                        setShowToolsPopover(false)
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/[0.03] transition-colors flex items-center gap-2.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download context</span>
                    </button>
                    <button
                      onClick={handleDatabaseBackup}
                      disabled={isBackingUp}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2.5 cursor-pointer",
                        isBackingUp 
                          ? "text-white/40 cursor-not-allowed" 
                          : "text-white/80 hover:text-white hover:bg-white/[0.03]"
                      )}
                    >
                      <FolderArchive className="w-3.5 h-3.5" />
                      <span>{isBackingUp ? 'Backing up...' : 'Backup database'}</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* --- RIGHT SIDEBAR: CONSOLE VIEW --- */}
      <main className="flex-grow flex flex-col min-w-0 bg-[#070709]/20">

        {/* Mobile table selector (replaces the desktop sidebar on small screens) */}
        {initialTab !== 'sql' && (
          <div className="lg:hidden flex items-center gap-2 p-2 border-b border-white/[0.06] shrink-0 bg-white/[0.005]">
            <Database className="w-4 h-4 text-accent shrink-0" />
            <div className="flex-grow min-w-0">
              <Select
                aria-label="Select table"
                value={selectedTable}
                onChange={handleSelectTable}
                options={tablesList.map((t) => ({ value: t.name, label: t.name }))}
                placeholder={isLoadingTables ? 'Loading tables…' : 'Select a table'}
                className="font-mono"
              />
            </div>
            <span className="text-[10px] font-mono text-white/30 shrink-0">{tablesList.length} tables</span>
          </div>
        )}

        {/* Neon style Top Toolbar */}
        <div className="min-h-12 border-b border-white/[0.06] flex items-center justify-between gap-2 px-4 shrink-0 bg-[#0d0d11]">

          {/* Left side actions (DATA/STRUCTURE tabs, history nav, search/filters, sort, columns dropdown, insert button) */}
          <div className="flex items-center gap-4 min-w-0 overflow-x-auto no-scrollbar">
            
            {/* DATA / STRUCTURE Tabs */}
            <div className="flex items-center bg-white/[0.03] border border-white/[0.06] p-0.5 rounded-lg">
              {initialTab !== 'sql' ? (
                <>
                  <button
                    onClick={() => setActiveSubTab('data')}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-semibold tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1.5",
                      activeSubTab === 'data'
                        ? "bg-white/[0.06] text-white shadow-sm"
                        : "text-white/40 hover:text-white/80"
                    )}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>DATA</span>
                  </button>
                  <button
                    onClick={() => setActiveSubTab('structure')}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-semibold tracking-wider transition-all duration-200 cursor-pointer flex items-center gap-1.5",
                      activeSubTab === 'structure'
                        ? "bg-white/[0.06] text-white shadow-sm"
                        : "text-white/40 hover:text-white/80"
                    )}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>STRUCTURE</span>
                  </button>

                </>
              ) : (
                <div className="px-3 py-1 text-xs font-medium text-white tracking-wider flex items-center gap-1.5 select-none font-mono text-accent">
                  <Terminal className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span>SQL EDITOR</span>
                </div>
              )}
            </div>

            {/* History arrows removed per user feedback */}

            {/* Table-level interactive dropdowns */}
            {selectedTable && activeSubTab === 'data' && (
              <div className="flex items-center gap-2 py-1 shrink-0">
                
                {/* Filters Button */}
                <button
                  onClick={() => {
                    setShowFilterBar(!showFilterBar)
                    setShowSortDropdown(false)
                    setShowColumnsDropdown(false)
                    setShowActionsDropdown(false)
                  }}
                  className={cn(
                    "h-8 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0",
                    showFilterBar || filtersList.some(f => f.value.trim() !== '' || f.operator.includes('null'))
                      ? "border-accent/30 bg-accent/10 text-accent"
                      : "border-white/[0.06] bg-white/[0.02] text-white/70 hover:text-white hover:bg-white/[0.04]"
                  )}
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  {filtersList.some(f => f.value.trim() !== '' || f.operator.includes('null')) && (
                    <span className="bg-accent text-[#0a0a0a] text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                      {filtersList.filter(f => f.value.trim() !== '' || f.operator.includes('null')).length}
                    </span>
                  )}
                </button>

                {/* Sort Dropdown */}
                <div className="relative">
                  <button
                    ref={sortBtnRef}
                    onClick={() => {
                      setShowSortDropdown(!showSortDropdown)
                      setShowColumnsDropdown(false)
                      setShowActionsDropdown(false)
                    }}
                    className={cn(
                      "h-8 px-3 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0",
                      sortBy
                        ? "border-accent/30 bg-accent/10 text-accent"
                        : "border-white/[0.06] bg-white/[0.02] text-white/70 hover:text-white hover:bg-white/[0.04]"
                    )}
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                    <span>Sort</span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>

                  <PortalDropdown triggerRef={sortBtnRef} open={showSortDropdown} onClose={() => setShowSortDropdown(false)}>
                    <div className="w-56 bg-[#0d0d11] border border-white/[0.08] rounded-xl shadow-2xl p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[10px] uppercase font-medium text-white/40 mb-1">
                        <span>Sort By</span>
                        <div className="flex items-center gap-1.5 lowercase">
                          <span className="text-[10px]">Ascending</span>
                          <button
                            type="button"
                            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                            className={cn(
                              "relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                              sortOrder === 'asc' ? "bg-accent" : "bg-white/10"
                            )}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                sortOrder === 'asc' ? "translate-x-3" : "translate-x-0"
                              )}
                            />
                          </button>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="Search column..."
                        value={sortSearchQuery}
                        onChange={(e) => setSortSearchQuery(e.target.value)}
                        className="bg-white/[0.02] border border-white/[0.06] rounded-lg px-2 py-1 focus:outline-none focus:border-accent text-xs text-white w-full mb-1"
                      />
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {columns
                          .filter(c => c.name.toLowerCase().includes(sortSearchQuery.toLowerCase()))
                          .map(col => (
                            <button
                              key={col.name}
                              onClick={() => { setSortBy(col.name === sortBy ? '' : col.name) }}
                              className={cn(
                                "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center justify-between cursor-pointer",
                                sortBy === col.name
                                  ? "bg-accent/10 text-accent font-semibold"
                                  : "text-white/60 hover:text-white hover:bg-white/[0.03]"
                              )}
                            >
                              <span>{col.name}</span>
                              {sortBy === col.name && <Check className="w-3.5 h-3.5" />}
                            </button>
                          ))}
                      </div>
                    </div>
                  </PortalDropdown>
                </div>

                {/* Columns Dropdown */}
                <div className="relative">
                  <button
                    ref={columnsBtnRef}
                    onClick={() => {
                      setShowColumnsDropdown(!showColumnsDropdown)
                      setShowSortDropdown(false)
                      setShowActionsDropdown(false)
                    }}
                    className="h-8 px-3 rounded-lg border border-white/[0.06] bg-white/[0.02] text-xs font-medium text-white/70 hover:text-white hover:bg-white/[0.04] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Columns</span>
                    <ChevronDown className="w-3 h-3 opacity-60" />
                  </button>

                  <PortalDropdown triggerRef={columnsBtnRef} open={showColumnsDropdown} onClose={() => setShowColumnsDropdown(false)}>
                    <div className="w-64 bg-[#0d0d11] border border-white/[0.08] rounded-xl shadow-2xl p-3 flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[10px] uppercase font-medium text-white/40 mb-1">
                        <span>Manage columns</span>
                        <button
                          type="button"
                          onClick={() => {
                            const allColNames = columns.map(c => c.name)
                            if (visibleColumns.length === columns.length) {
                              const minCol = primaryKeys[0] || allColNames[0]
                              setVisibleColumns([minCol])
                            } else {
                              setVisibleColumns(allColNames)
                            }
                          }}
                          className="text-[9px] hover:text-white transition-colors lowercase cursor-pointer"
                        >
                          {visibleColumns.length === columns.length ? "Hide all" : "Show all"}
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder="Search..."
                        value={columnSearchQuery}
                        onChange={(e) => setColumnSearchQuery(e.target.value)}
                        className="bg-white/[0.02] border border-white/[0.06] rounded-lg px-2 py-1 focus:outline-none focus:border-accent text-xs text-white w-full mb-1"
                      />
                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {columns
                          .filter(c => c.name.toLowerCase().includes(columnSearchQuery.toLowerCase()))
                          .map(col => {
                            const isVisible = visibleColumns.includes(col.name)
                            return (
                              <button
                                key={col.name}
                                onClick={() => {
                                  if (isVisible) {
                                    if (visibleColumns.length > 1) setVisibleColumns(prev => prev.filter(c => c !== col.name))
                                  } else {
                                    setVisibleColumns(prev => [...prev, col.name])
                                  }
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono text-white/60 hover:text-white hover:bg-white/[0.03] transition-colors flex items-center justify-between cursor-pointer group"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-white/30 group-hover:text-white/50"><GripVertical className="w-3 h-3" /></span>
                                  <span className={cn(isVisible ? "text-white" : "text-white/40 line-through")}>{col.name}</span>
                                </div>
                                <span>
                                  {isVisible ? <Eye className="w-3.5 h-3.5 text-accent" /> : <EyeOff className="w-3.5 h-3.5 text-white/20" />}
                                </span>
                              </button>
                            )
                          })}
                      </div>
                    </div>
                  </PortalDropdown>
                </div>

                {/* Add record button (green/accent) */}
                {isSuperAdmin && (
                  <button
                    onClick={() => {
                      setNewRecordData({})
                      setIsAddModalOpen(true)
                    }}
                    className="h-8 px-3 rounded-lg bg-accent/10 border border-accent/20 text-accent text-xs font-semibold flex items-center gap-1.5 hover:bg-accent hover:text-[#0a0a0a] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add record</span>
                  </button>
                )}

                {/* Bulk Delete action (visible only when items selected) */}
                {isSuperAdmin && selectedRowKeys.length > 0 && (
                  <button
                    onClick={handleDeleteSelectedRecords}
                    className="h-8 px-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1.5 hover:bg-red-500 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete ({selectedRowKeys.length})</span>
                  </button>
                )}

                {/* Execution Time */}
                <span className="text-[10px] text-white/30 font-mono hidden md:inline whitespace-nowrap shrink-0">
                  {queryTimeMs > 0 ? `${queryTimeMs}ms` : ''}
                </span>
              </div>
            )}
          </div>

          {/* Right: reload & more actions */}
          <div className="flex items-center gap-3 shrink-0 ml-2">
            {selectedTable && activeSubTab === 'data' && (
              <>
                {/* Reload button */}
                <button
                  onClick={fetchTableMetadataAndData}
                  disabled={isLoadingData}
                  className="w-8 h-8 rounded-lg border border-white/[0.06] bg-white/[0.02] flex items-center justify-center text-white/60 hover:text-white hover:border-white/12 transition-colors disabled:opacity-30 cursor-pointer"
                  title="Refresh table data"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isLoadingData ? "animate-spin" : "")} />
                </button>

                {/* More Actions menu (`...`) */}
                <div className="relative">
                  <button
                    ref={actionsBtnRef}
                    onClick={() => {
                      setShowActionsDropdown(!showActionsDropdown)
                      setShowSortDropdown(false)
                      setShowColumnsDropdown(false)
                    }}
                    className="h-8 px-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] flex items-center gap-1.5 text-white/60 hover:text-white hover:border-white/12 transition-colors cursor-pointer"
                    title="More actions"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium hidden sm:inline">Actions</span>
                  </button>

                  <PortalDropdown triggerRef={actionsBtnRef} open={showActionsDropdown} onClose={() => setShowActionsDropdown(false)} align="right">
                    <div className="w-52 bg-[#0d0d11] border border-white/[0.08] rounded-xl shadow-2xl p-1.5 flex flex-col">
                      <button
                        onClick={() => {
                          fetchTableMetadataAndData()
                          setShowActionsDropdown(false)
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/[0.03] transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Refresh rows</span>
                      </button>
                      <button
                        onClick={async () => {
                          await fetchTables()
                          await fetchTableMetadataAndData()
                          setShowActionsDropdown(false)
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/[0.03] transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>Refresh schema</span>
                      </button>

                      <div className="border-t border-white/[0.06] my-1" />

                      <button
                        onClick={() => {
                          exportToJson(rows, `${selectedTable}_all.json`)
                          setShowActionsDropdown(false)
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/[0.03] transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export all to .json</span>
                      </button>
                      <button
                        onClick={() => {
                          exportToCsv(rows, columns.map(c => c.name), `${selectedTable}_all.csv`)
                          setShowActionsDropdown(false)
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/[0.03] transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export all to .csv</span>
                      </button>
                      <button
                        onClick={() => {
                          exportToTsv(rows, columns.map(c => c.name), `${selectedTable}_all.xlsx`)
                          setShowActionsDropdown(false)
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/[0.03] transition-colors flex items-center gap-2 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export all to .xlsx</span>
                      </button>

                      {selectedRowKeys.length > 0 && (
                        <>
                          <div className="border-t border-white/[0.06] my-1" />
                          <button
                            onClick={() => {
                              const selectedRows = rows.filter(r => selectedRowKeys.includes(r[primaryKeyCol]))
                              exportToJson(selectedRows, `${selectedTable}_selected.json`)
                              setShowActionsDropdown(false)
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/[0.03] transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Export selected to .json</span>
                          </button>
                          <button
                            onClick={() => {
                              const selectedRows = rows.filter(r => selectedRowKeys.includes(r[primaryKeyCol]))
                              exportToCsv(selectedRows, columns.map(c => c.name), `${selectedTable}_selected.csv`)
                              setShowActionsDropdown(false)
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/[0.03] transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Export selected to .csv</span>
                          </button>
                          <button
                            onClick={() => {
                              const selectedRows = rows.filter(r => selectedRowKeys.includes(r[primaryKeyCol]))
                              exportToTsv(selectedRows, columns.map(c => c.name), `${selectedTable}_selected.xlsx`)
                              setShowActionsDropdown(false)
                            }}
                            className="w-full text-left px-3 py-2 rounded-lg text-xs text-white/80 hover:text-white hover:bg-white/[0.03] transition-colors flex items-center gap-2 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Export selected to .xlsx</span>
                          </button>
                        </>
                      )}
                    </div>
                  </PortalDropdown>
                </div>
              </>
            )}
          </div>
        </div>

        {/* --- INLINE MULTIPLE FILTERS ROW PANEL --- */}
        {selectedTable && activeSubTab === 'data' && showFilterBar && (
          <div className="px-4 py-3 bg-[#0a0a0c] border-b border-white/[0.06] flex flex-col gap-2 transition-all select-none">
            {filtersList.map((filter, fIdx) => (
              <div key={filter.id} className="flex items-center gap-2 flex-wrap">
                
                {/* Delete row button */}
                <button
                  onClick={() => {
                    const newList = filtersList.filter(f => f.id !== filter.id)
                    setFiltersList(newList)
                    if (newList.length === 0) {
                      setShowFilterBar(false)
                    }
                  }}
                  className="p-1 hover:bg-white/5 text-white/40 hover:text-white rounded transition-colors cursor-pointer"
                  title="Remove filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Condition label: where or and */}
                <span className="px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-[10px] font-medium text-white/40 font-mono">
                  {fIdx === 0 ? 'where' : 'and'}
                </span>

                {/* Column Select */}
                <Select
                  value={filter.column}
                  onChange={(val) => {
                    setFiltersList(prev => prev.map(f => f.id === filter.id ? { ...f, column: val } : f))
                  }}
                  size="sm"
                  className="font-mono w-40"
                  options={columns.map(col => ({ value: col.name, label: col.name }))}
                />

                {/* Operator Select */}
                <Select
                  value={filter.operator}
                  onChange={(val) => {
                    setFiltersList(prev => prev.map(f => f.id === filter.id ? { ...f, operator: val } : f))
                  }}
                  size="sm"
                  className="font-mono w-32"
                  options={[
                    { value: "equals", label: "equals" },
                    { value: "contains", label: "contains" },
                    { value: "starts_with", label: "starts with" },
                    { value: "ends_with", label: "ends with" },
                    { value: "is_null", label: "is null" },
                    { value: "is_not_null", label: "is not null" },
                    { value: "greater_than", label: "greater than" },
                    { value: "less_than", label: "less than" }
                  ]}
                />

                {/* Value Input */}
                {filter.operator !== 'is_null' && filter.operator !== 'is_not_null' && (
                  <input
                    type="text"
                    value={filter.value}
                    onChange={(e) => {
                      setFiltersList(prev => prev.map(f => f.id === filter.id ? { ...f, value: e.target.value } : f))
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') fetchTableMetadataAndData()
                    }}
                    placeholder="value..."
                    className="bg-[#0d0d11] border border-white/[0.08] text-xs text-white rounded px-2.5 py-1 focus:outline-none focus:border-accent min-w-[120px] max-w-[200px]"
                  />
                )}
              </div>
            ))}

            {/* Controls at the bottom of filters bar */}
            <div className="flex items-center gap-3 mt-1 pl-7 border-t border-white/[0.04] pt-2">
              <button
                onClick={() => {
                  setFiltersList(prev => [
                    ...prev,
                    { id: Math.random().toString(), column: columns[0]?.name || '', operator: 'equals', value: '' }
                  ])
                }}
                className="text-[11px] font-medium text-white/70 hover:text-white flex items-center gap-1 hover:bg-white/5 px-2 py-1 rounded transition-colors cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add filter</span>
              </button>

              <span className="text-white/20 select-none">|</span>

              <button
                onClick={handleClearFilter}
                className="text-[11px] font-medium text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                Clear filters
              </button>

              <button
                onClick={fetchTableMetadataAndData}
                className="ml-auto px-3 py-1 bg-accent text-[#0a0a0a] text-xs font-semibold rounded hover:bg-accent/80 transition-colors cursor-pointer"
              >
                Apply filters
              </button>
            </div>
          </div>
        )}

        {/* --- DYNAMIC RENDER OF VIEW --- */}
        <div className="flex-grow min-h-0 overflow-auto p-4 relative">
          
          {activeSubTab === 'sql' ? (
            <div className="flex flex-col h-full min-h-0 text-left space-y-4">
              
              {/* Inner Tabs: Console vs. Requests Log */}
              {isSuperAdmin && (
                <div className="flex items-center gap-2 border-b border-white/[0.06] pb-2 shrink-0">
                  <button
                    onClick={() => setSqlEditorMode('console')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer border",
                      sqlEditorMode === 'console'
                        ? "bg-accent/10 text-accent border-accent/20"
                        : "text-white/60 hover:text-white hover:bg-white/[0.02] border-transparent"
                    )}
                  >
                    Query Console
                  </button>
                  <button
                    onClick={() => {
                      setSqlEditorMode('requests')
                      fetchRequests()
                    }}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 border",
                      sqlEditorMode === 'requests'
                        ? "bg-accent/10 text-accent border-accent/20"
                        : "text-white/60 hover:text-white hover:bg-white/[0.02] border-transparent"
                    )}
                  >
                    <span>Requests Log</span>
                    {pendingRequestsCount > 0 && (
                      <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold leading-none animate-pulse">
                        {pendingRequestsCount}
                      </span>
                    )}
                  </button>
                </div>
              )}

              {sqlEditorMode === 'console' || !isSuperAdmin ? (
                <>
                  {/* SQL Query Editor Box */}
                  <div className="border border-white/[0.06] rounded-xl bg-[#0d0d11] p-4 flex flex-col shrink-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs font-medium text-white/70">
                        <Terminal className="w-3.5 h-3.5 text-accent" />
                        <span>SQL Editor Console</span>
                      </div>
                      
                      {/* Query Templates / Snippets — hidden on mobile */}
                      <div className="hidden sm:flex items-center gap-1.5 overflow-x-auto max-w-xl no-scrollbar py-0.5">
                        <span className="text-[10px] text-white/30 uppercase font-semibold shrink-0 mr-1">Templates:</span>
                        {[
                          { label: 'Subscribers List', query: 'SELECT * FROM subscribers LIMIT 10;' },
                          { label: 'Users List', query: 'SELECT * FROM users LIMIT 10;' },
                          { label: 'Admins List', query: 'SELECT * FROM admins LIMIT 10;' },
                          { label: 'Database Version', query: 'SELECT version();' }
                        ].map((t) => (
                          <button
                            key={t.label}
                            onClick={() => setSqlQuery(t.query)}
                            className="text-[10px] px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.08] hover:border-white/12 text-white/60 hover:text-white transition-colors cursor-pointer whitespace-nowrap font-mono"
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="relative">
                      <textarea
                        value={sqlQuery}
                        onChange={(e) => setSqlQuery(e.target.value)}
                        placeholder="-- Type your PostgreSQL query here...&#10;SELECT * FROM subscribers LIMIT 10;"
                        className="w-full h-36 bg-[#070709] border border-white/[0.06] rounded-lg p-3 text-xs font-mono text-white/80 focus:outline-none focus:border-accent/40 resize-y leading-relaxed"
                        spellCheck={false}
                      />
                    </div>

                    {sqlQuery.trim().length > 0 && (() => {
                      const explanation = explainSQL(sqlQuery);
                      if (!explanation) return null;
                      return (
                        <div className={cn(
                          "rounded-lg p-3 border text-xs font-sans space-y-1 transition-all duration-300",
                          explanation.isWarning 
                            ? "bg-red-500/5 border-red-500/20 text-red-400/90 shadow-[0_0_15px_rgba(239,68,68,0.03)]" 
                            : "bg-white/[0.02] border-white/[0.06] text-white/70"
                        )}>
                          <div className="flex items-center gap-1.5 font-medium text-white/90">
                            <AlertCircle className={cn("w-3.5 h-3.5", explanation.isWarning ? "text-red-400" : "text-accent")} />
                            <span>Action: {explanation.action}</span>
                          </div>
                          <p className="text-white/55 leading-relaxed pl-5 text-[11px] font-mono">{explanation.description}</p>
                          {explanation.isWarning && explanation.warningText && (
                            <p className="text-red-400 font-semibold pl-5 text-[11px] mt-1">
                              ⚠️ {explanation.warningText}
                            </p>
                          )}
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-between border-t border-white/[0.04] pt-3">
                      <div className="text-[10px] text-white/30 font-mono">
                        {isSuperAdmin ? 'Press Run Query to execute against database.' : 'Writes will prompt for Super Admin approval.'}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSqlQuery('')
                            setSqlResult(null)
                          }}
                          className="h-8 px-3 rounded-lg border border-white/[0.06] bg-white/[0.02] text-white/70 hover:text-white hover:bg-white/[0.04] text-xs font-medium cursor-pointer transition-colors"
                        >
                          Clear
                        </button>
                        <button
                          onClick={handleExecuteQuery}
                          disabled={isExecutingSql}
                          className="h-8 px-3 rounded-lg bg-accent text-[#0a0a0a] hover:bg-accent/80 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all shadow-lg shadow-accent/5"
                        >
                          {isExecutingSql ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Running...</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current text-[#0a0a0a]" />
                              <span>Run</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* SQL Results View */}
                  <div className="border border-white/[0.06] rounded-xl bg-[#0d0d11] flex-grow min-h-0 flex flex-col relative overflow-hidden">
                    {isExecutingSql ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30 space-y-2 bg-[#060608]/40 z-10">
                        <RefreshCw className="w-6 h-6 animate-spin text-accent" />
                        <p className="text-xs font-medium">Running SQL query...</p>
                      </div>
                    ) : null}

                    {!sqlResult ? (
                      <div className="flex-grow flex flex-col items-center justify-center text-white/30 space-y-2 py-12">
                        <Terminal className="w-8 h-8 text-white/10" />
                        <p className="text-sm">Execute a query above to see the results here.</p>
                      </div>
                    ) : !sqlResult.success ? (
                      <div className="flex-grow p-5 overflow-y-auto">
                        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400">
                          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            <h5 className="text-sm font-semibold">SQL Error</h5>
                            <p className="text-xs font-mono whitespace-pre-wrap">{sqlResult.error}</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col h-full min-h-0">
                        <div className="px-4 py-2 border-b border-white/[0.06] bg-white/[0.01] flex items-center justify-between text-[11px] text-white/45">
                          <div className="flex items-center gap-4">
                            <span>Query completed in <strong className="text-white/70 font-mono">{sqlResult.duration} ms</strong></span>
                            <span className="text-white/10">|</span>
                            <span>Affected: <strong className="text-white/70 font-mono">{sqlResult.affectedRows} rows</strong></span>
                            <span className="text-white/10">|</span>
                            <span>Returned: <strong className="text-white/70 font-mono">{sqlResult.rows.length} rows</strong></span>
                          </div>
                        </div>

                        <div className="flex-grow overflow-auto min-h-0">
                          {sqlResult.rows.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-white/20 py-12 text-xs italic">
                              Query succeeded. No rows returned.
                            </div>
                          ) : (
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-white/[0.02] border-b border-white/[0.06] text-white/50 select-none font-mono">
                                  <th className="px-4 py-2 text-center w-10 text-[10px] text-white/25">#</th>
                                  {sqlResult.headers.map((h: string) => (
                                    <th key={h} className="px-4 py-2 font-semibold tracking-tight whitespace-nowrap">
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-white/[0.04] font-mono select-text">
                                {sqlResult.rows.map((row: any, rIdx: number) => (
                                  <tr key={rIdx} className="hover:bg-white/[0.005] transition-colors border-b border-white/[0.02]/50 last:border-b-0">
                                    <td className="px-4 py-2 text-center text-[10px] text-white/20 select-none">
                                      {rIdx + 1}
                                    </td>
                                    {sqlResult.headers.map((h: string) => {
                                      const val = row[h]
                                      const stringVal = val === null 
                                        ? <span className="text-white/20 italic">null</span>
                                        : typeof val === 'object' 
                                        ? JSON.stringify(val) 
                                        : String(val)
                                      return (
                                        <td key={h} className="px-4 py-2 whitespace-nowrap text-white/80 max-w-xs truncate" title={typeof val === 'object' ? JSON.stringify(val) : String(val)}>
                                          {stringVal}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* Requests Log Panel */
                <div className="flex-grow border border-white/[0.06] rounded-xl bg-[#0d0d11] p-4 flex flex-col min-h-0 relative overflow-hidden">
                  <div className="flex items-center justify-between pb-3 border-b border-white/[0.06] shrink-0">
                    <h4 className="text-xs font-medium text-white/85">SQL Changes Queue & Request Logs</h4>
                    <button
                      onClick={fetchRequests}
                      disabled={isLoadingRequests}
                      className="p-1 rounded hover:bg-white/5 text-white/50 hover:text-white transition-colors cursor-pointer"
                    >
                      <RefreshCw className={cn("w-3.5 h-3.5", isLoadingRequests ? "animate-spin" : "")} />
                    </button>
                  </div>

                  <div className="flex-grow overflow-y-auto py-2 space-y-3.5 pr-1.5 min-h-0 mt-2">
                    {isLoadingRequests && requestsList.length === 0 ? (
                      <div className="space-y-3 py-2">
                        {[...Array(5)].map((_, i) => (
                          <div key={i} className="rounded-lg border border-white/[0.06] bg-white/[0.01] p-3 space-y-2">
                            <div className="flex justify-between">
                              <Skeleton className="h-3.5 w-28" />
                              <Skeleton className="h-3.5 w-14" />
                            </div>
                            <Skeleton className="h-3 w-3/4" />
                          </div>
                        ))}
                      </div>
                    ) : requestsList.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-white/20 py-12 text-xs italic space-y-1">
                        <Terminal className="w-6 h-6 text-white/10" />
                        <p>No query approval requests found.</p>
                      </div>
                    ) : (
                      requestsList.map((req) => {
                        const statusColors = {
                          pending: "bg-amber-500/10 text-amber-500 border-amber-500/25",
                          approved: "bg-emerald-500/10 text-emerald-500 border-emerald-500/25",
                          rejected: "bg-red-500/10 text-red-500 border-red-500/25"
                        }[req.status as 'pending' | 'approved' | 'rejected'] || "bg-white/10 text-white/60 border-white/20"

                        const resultsData = req.executionResults ? (typeof req.executionResults === 'string' ? JSON.parse(req.executionResults) : req.executionResults) : null

                        return (
                          <div key={req.id} className="p-4 rounded-xl border border-white/[0.05] bg-[#070709] flex flex-col gap-3">
                            <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                              <div className="flex items-center gap-2 text-white/60 font-semibold">
                                <span className="text-white/85 font-mono">{req.requesterName}</span>
                                <span>requested at</span>
                                <span className="text-[11px] font-sans font-normal text-white/40">{new Date(req.createdAt).toLocaleString()}</span>
                              </div>
                              <span className={cn("px-2.5 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider", statusColors)}>
                                {req.status}
                              </span>
                            </div>

                            {/* Query text panel */}
                            <div className="relative">
                              <pre className="bg-black/50 border border-white/[0.04] p-3 rounded-lg text-[11px] font-mono text-[#a78bfa] overflow-x-auto whitespace-pre-wrap select-text leading-relaxed">
                                {req.queryText}
                              </pre>
                            </div>

                            {/* Query explanation in Requests Log */}
                            {(() => {
                              const explanation = explainSQL(req.queryText);
                              if (!explanation) return null;
                              return (
                                <div className={cn(
                                  "rounded-lg p-2.5 border text-[11px] font-sans space-y-0.5 transition-all duration-300",
                                  explanation.isWarning 
                                    ? "bg-red-500/5 border-red-500/15 text-red-400/90 shadow-[0_0_15px_rgba(239,68,68,0.02)]" 
                                    : "bg-white/[0.015] border-white/[0.05] text-white/60"
                                )}>
                                  <div className="flex items-center gap-1.5 font-medium text-white/85">
                                    <AlertCircle className={cn("w-3 h-3", explanation.isWarning ? "text-red-400" : "text-accent")} />
                                    <span>Action: {explanation.action}</span>
                                  </div>
                                  <p className="text-white/45 leading-relaxed pl-4.5 font-mono">{explanation.description}</p>
                                  {explanation.isWarning && explanation.warningText && (
                                    <p className="text-red-400/90 font-semibold pl-4.5 mt-0.5">
                                      ⚠️ {explanation.warningText}
                                    </p>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Approval metadata / Rejection info */}
                            {req.status === 'rejected' && (
                              <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-lg text-xs text-red-400 font-sans">
                                <strong>Rejection Reason:</strong> {req.rejectionReason}
                              </div>
                            )}

                            {req.status === 'approved' && (
                              <div className="text-xs text-white/40 flex flex-wrap gap-x-4 gap-y-1 font-mono py-1 border-t border-white/[0.03]">
                                <span>Reviewed By: <strong className="text-white/75">{req.reviewerName || 'Super Admin'}</strong></span>
                                <span>Duration: <strong className="text-white/75">{req.executionDurationMs} ms</strong></span>
                                {resultsData && (
                                  <>
                                    <span>Affected: <strong className="text-white/75">{resultsData.affectedRows ?? 0} rows</strong></span>
                                    <span>Returned: <strong className="text-white/75">{resultsData.rowCount ?? 0} rows</strong></span>
                                  </>
                                )}
                              </div>
                            )}

                            {/* Collapsible approved query results table */}
                            {req.status === 'approved' && resultsData && resultsData.rows && resultsData.rows.length > 0 && (
                              <div className="mt-1 font-sans">
                                <button
                                  onClick={() => setExpandedRequestResultsId(expandedRequestResultsId === req.id ? null : req.id)}
                                  className="text-[11px] text-accent/80 hover:text-accent font-semibold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  {expandedRequestResultsId === req.id ? 'Collapse Query Results' : 'View Query Results Grid'}
                                  <ChevronDown className={cn("w-3 h-3 transition-transform", expandedRequestResultsId === req.id ? "rotate-180" : "")} />
                                </button>

                                {expandedRequestResultsId === req.id && (
                                  <div className="mt-2.5 max-h-48 overflow-auto border border-white/[0.06] rounded-lg bg-black/30">
                                    <table className="w-full text-left border-collapse text-[11px] font-mono">
                                      <thead>
                                        <tr className="bg-white/[0.02] border-b border-white/[0.06] text-white/45">
                                          <th className="px-3 py-1.5 text-center w-8 text-white/20">#</th>
                                          {resultsData.headers.map((h: string) => (
                                            <th key={h} className="px-3 py-1.5 font-semibold whitespace-nowrap">{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-white/[0.03] select-text">
                                        {resultsData.rows.map((row: any, rIdx: number) => (
                                          <tr key={rIdx} className="hover:bg-white/[0.005]">
                                            <td className="px-3 py-1.5 text-center text-white/20 select-none">{rIdx + 1}</td>
                                            {resultsData.headers.map((h: string) => (
                                              <td key={h} className="px-3 py-1.5 whitespace-nowrap text-white/70 max-w-xs truncate" title={String(row[h])}>
                                                {row[h] === null ? <span className="text-white/20 italic">null</span> : String(row[h])}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                    {resultsData.wasCapped && (
                                      <div className="px-3 py-1.5 bg-white/[0.02] text-[10px] text-white/30 italic text-center">
                                        Showing first 100 rows. Results capped to prevent server bloat.
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {req.status === 'approved' && req.executionError && (
                              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400 font-sans">
                                <div className="font-semibold mb-0.5">Execution Failed during Approval:</div>
                                <p className="font-mono">{req.executionError}</p>
                              </div>
                            )}

                            {/* Approval actions for super admin */}
                            {isSuperAdmin && req.status === 'pending' && (
                              <div className="flex items-center justify-end gap-2 border-t border-white/[0.04] pt-3 mt-1 font-sans">
                                <button
                                  disabled={isReviewingRequest !== null}
                                  onClick={() => setShowRejectionModal(req.id)}
                                  className="h-7 px-3.5 rounded-lg border border-red-500/25 bg-red-500/5 hover:bg-red-500/15 text-red-400 text-xs font-semibold cursor-pointer transition-colors"
                                >
                                  Reject
                                </button>
                                <button
                                  disabled={isReviewingRequest !== null}
                                  onClick={() => handleReviewRequest(req.id, 'approve')}
                                  className="h-7 px-3.5 rounded-lg bg-emerald-500 text-[#052e16] hover:bg-emerald-400 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-emerald-500/5"
                                >
                                  {isReviewingRequest === req.id ? (
                                    <>
                                      <RefreshCw className="w-3 h-3 animate-spin" />
                                      <span>Running...</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-3 h-3 fill-current text-[#052e16]" />
                                      <span>Approve & Run</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : !selectedTable ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white/30 space-y-2">
              <Database className="w-8 h-8 text-white/10" />
              <p className="text-sm">Select a table in the sidebar to begin</p>
            </div>
          ) : isLoadingData && rows.length === 0 ? (
            <div className="absolute inset-0 bg-[#060608]/40 p-4 space-y-2 overflow-hidden">
              {/* header row */}
              <div className="flex gap-3 pb-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-4 flex-1" />
                ))}
              </div>
              {/* body rows */}
              {[...Array(10)].map((_, r) => (
                <div key={r} className="flex gap-3">
                  {[...Array(5)].map((_, c) => (
                    <Skeleton key={c} className="h-3.5 flex-1" />
                  ))}
                </div>
              ))}
            </div>
          ) : activeSubTab === 'structure' ? (
            
            /* ==================== CODE-HIGHLIGHTED TABLE STRUCTURE VIEW ==================== */
            <div className="flex flex-col gap-6 text-left max-w-4xl pb-10">
              
              {/* Structure Header Controls */}
              <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl border border-white/[0.06] bg-[#0d0d11] shrink-0 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-white/30 uppercase font-semibold">Table name</span>
                  <input
                    type="text"
                    value={selectedTable}
                    disabled
                    className="bg-[#121217] border border-white/10 rounded px-2.5 py-1 text-white/80 font-mono text-xs w-44 cursor-not-allowed"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-white/30 uppercase font-semibold">Schema</span>
                  <Select
                    disabled
                    value="public"
                    onChange={() => {}}
                    size="sm"
                    className="font-mono w-24 cursor-not-allowed"
                    options={[{ value: 'public', label: 'public' }]}
                  />
                </div>

                {/* RLS Toggle switch */}
                <div className="flex items-center gap-3 border-l border-white/10 pl-4 ml-auto">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-white/80 whitespace-nowrap">Row Level Security</span>
                    <span className="text-[10px] text-white/40 whitespace-nowrap">Isolate queries by user policies</span>
                  </div>
                  <button
                    disabled={!isSuperAdmin}
                    onClick={() => {
                      if (!isSuperAdmin) return
                      setRowLevelSecurityEnabled(!rowLevelSecurityEnabled)
                    }}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                      isSuperAdmin ? "cursor-pointer" : "cursor-not-allowed opacity-50",
                      rowLevelSecurityEnabled ? "bg-accent" : "bg-white/10"
                    )}
                  >
                    <span className={cn(
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                      rowLevelSecurityEnabled ? "translate-x-4" : "translate-x-0"
                    )} />
                  </button>
                </div>
              </div>

              {/* COLUMNS code layout */}
              <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#0d0d11] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <h4 className="text-xs uppercase font-bold text-white/45 tracking-wider">Columns</h4>
                  {isSuperAdmin && (
                  <button
                    onClick={() => toast('Schema migrations are disabled in visual override mode.', 'info')}
                    className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add column</span>
                  </button>
                  )}
                </div>
                <div className="bg-[#070709]/50 border border-white/[0.04] rounded-lg p-4 font-mono select-text">
                  {columns.map((col) => {
                    let parts = [`${col.name}`, `${col.type.toUpperCase()}`]
                    if (col.isPrimaryKey) parts.push('PRIMARY KEY')
                    if (col.isForeignKey && col.references) parts.push(`REFERENCES ${col.references}`)
                    if (!col.nullable) parts.push('NOT NULL')
                    if (col.defaultVal) {
                      parts.push(`DEFAULT ${col.defaultVal}`)
                    }
                    if (col.name.includes('email') || col.name.includes('username')) {
                      parts.push('UNIQUE')
                    }
                    return (
                      <SQLHighlightLine key={col.name} text={parts.join(' ')} />
                    )
                  })}
                </div>
              </div>

              {/* CONSTRAINTS */}
              <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#0d0d11] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <h4 className="text-xs uppercase font-bold text-white/45 tracking-wider">Constraints</h4>
                  {isSuperAdmin && (
                  <button
                    onClick={() => toast('Schema migrations are disabled in visual override mode.', 'info')}
                    className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add constraint</span>
                  </button>
                  )}
                </div>
                <div className="bg-[#070709]/50 border border-white/[0.04] rounded-lg p-4 font-mono select-text space-y-3">
                  {dynamicConstraints.length === 0 ? (
                    <span className="text-white/20 text-xs italic">No constraints configured.</span>
                  ) : (
                    dynamicConstraints.map((constraint, idx) => {
                      const isExpanded = activeConstraintEdit === constraint
                      return (
                        <div key={idx} className="border-b border-white/5 last:border-b-0 pb-3 last:pb-0">
                          {isExpanded ? (
                            <div className="p-4 bg-[#0a0a0c] border border-white/10 rounded-lg flex flex-col gap-3">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-white/40 uppercase font-semibold">Constraint name</span>
                                <input
                                  type="text"
                                  defaultValue={constraint.split(' ')[1]}
                                  className="bg-[#121217] border border-white/10 rounded px-2.5 py-1.5 text-white/80 font-mono text-xs w-full max-w-sm focus:outline-none focus:border-accent"
                                />
                              </div>
                              <div className="flex flex-col gap-1 text-xs font-sans">
                                <span className="text-[10px] text-white/40 uppercase font-semibold">Columns</span>
                                <div className="text-white/60 font-mono pl-1">
                                  {constraint.match(/\(([^)]+)\)/)?.[1] || 'id'}
                                </div>
                              </div>
                              <div className="flex justify-end gap-2 border-t border-white/[0.04] pt-3 mt-1 font-sans">
                                <button
                                  onClick={() => setActiveConstraintEdit('')}
                                  className="px-2.5 py-1 hover:bg-white/5 rounded text-white/50 text-[11px] cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => {
                                    toast('Constraint successfully modified!', 'success')
                                    setActiveConstraintEdit('')
                                  }}
                                  className="px-3 py-1 bg-accent text-[#0a0a0a] font-semibold rounded hover:bg-accent/80 text-[11px] cursor-pointer"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div 
                              onClick={() => { if (isSuperAdmin) setActiveConstraintEdit(constraint) }}
                              className={cn("p-1 rounded-md transition-colors", isSuperAdmin ? "cursor-pointer hover:bg-white/[0.02]" : "cursor-default")}
                              title={isSuperAdmin ? "Click to visually edit constraint details" : "View-only mode"}
                            >
                              <SQLHighlightLine text={constraint} />
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              {/* INDEXES */}
              <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#0d0d11] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <h4 className="text-xs uppercase font-bold text-white/45 tracking-wider">Indexes</h4>
                  {isSuperAdmin && (
                  <button
                    onClick={() => toast('Schema migrations are disabled in visual override mode.', 'info')}
                    className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Index</span>
                  </button>
                  )}
                </div>
                <div className="bg-[#070709]/50 border border-white/[0.04] rounded-lg p-4 font-mono select-text space-y-1">
                  {dynamicIndexes.length === 0 ? (
                    <span className="text-white/20 text-xs italic">No indexes configured.</span>
                  ) : (
                    dynamicIndexes.map((idxStr, idx) => (
                      <SQLHighlightLine key={idx} text={idxStr} />
                    ))
                  )}
                </div>
              </div>

              {/* POLICIES */}
              <div className="border border-white/[0.06] rounded-xl overflow-hidden bg-[#0d0d11] p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-white/[0.06] pb-2">
                  <h4 className="text-xs uppercase font-bold text-white/45 tracking-wider">Policies</h4>
                  {isSuperAdmin && (
                  <button
                    onClick={() => toast('Schema migrations are disabled in visual override mode.', 'info')}
                    className="text-[11px] font-semibold text-accent hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add policy</span>
                  </button>
                  )}
                </div>
                <div className="bg-[#070709]/50 border border-white/[0.04] rounded-lg p-4 font-mono select-text">
                  <span className="text-white/20 text-xs italic">No policies created. Toggle Row Level Security to define read/write policies.</span>
                </div>
              </div>
            </div>
            
          ) : (
            
            /* ==================== TABLE DATA VIEW ==================== */
            <div className="flex flex-col gap-4 h-full min-h-0">
              
              {/* Grid block */}
              <div className="border border-white/[0.06] rounded-xl bg-[#0d0d11] flex-grow min-h-0 overflow-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-white/[0.02] border-b border-white/[0.06] text-white/50 select-none">
                      
                      {/* Checkbox select-all */}
                      {isSuperAdmin && (
                        <th className="px-4 py-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={rows.length > 0 && selectedRowKeys.length === rows.length}
                            onChange={handleSelectAllRows}
                            className="rounded !border-white/20 !bg-black checked:!bg-accent text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5 transition-colors"
                          />
                        </th>
                      )}

                      {renderedColumns.map((col) => {
                        const isSorted = sortBy === col.name
                        return (
                          <th
                            key={col.name}
                            onClick={() => handleSort(col.name)}
                            className={cn(
                              "px-4 py-3 font-semibold font-mono tracking-tight cursor-pointer hover:bg-white/[0.01] transition-colors whitespace-nowrap",
                              isSorted ? "text-accent" : "text-white/60"
                            )}
                          >
                            <div className="flex items-center gap-1.5">
                              {col.isPrimaryKey && (
                                <KeyRound className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-label="Primary key">
                                  <title>Primary key</title>
                                </KeyRound>
                              )}
                              {col.isForeignKey && (
                                <Link2 className="w-3.5 h-3.5 text-sky-400 shrink-0" aria-label={`Foreign key → ${col.references}`}>
                                  <title>{`Foreign key → ${col.references}`}</title>
                                </Link2>
                              )}
                              <span>{col.name}</span>
                              {isSorted ? (
                                sortOrder === 'asc' ? (
                                  <ArrowUp className="w-3.5 h-3.5 text-accent opacity-100" />
                                ) : (
                                  <ArrowDown className="w-3.5 h-3.5 text-accent opacity-100" />
                                )
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-20" />
                              )}
                            </div>
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  
                  <tbody className="divide-y divide-white/[0.04]">
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={renderedColumns.length + (isSuperAdmin ? 1 : 0)} className="px-5 py-12 text-center text-white/30 font-mono">
                          {filtersList.length > 0 ? 'No records matching the applied filters found' : 'Table is currently empty.'}
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, rIdx) => {
                        const pkVal = row[primaryKeyCol]
                        const isRowSelected = selectedRowKeys.includes(pkVal)
                        const isRowEditing = editingCell?.rowIndex === rIdx

                        return (
                          <tr 
                            key={pkVal || rIdx} 
                            className={cn(
                              "group hover:bg-white/[0.005] transition-colors border-b border-white/[0.04] last:border-b-0",
                              isRowSelected ? "bg-accent/[0.01] hover:bg-accent/[0.015]" : "",
                              isRowEditing ? "relative z-40" : ""
                            )}
                          >
                            
                            {/* Checkbox row select */}
                            {isSuperAdmin && (
                              <td className="px-4 py-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={isRowSelected}
                                  onChange={(e) => handleSelectRow(pkVal, e.target.checked)}
                                  className="rounded !border-white/20 !bg-black checked:!bg-accent text-accent focus:ring-0 focus:ring-offset-0 cursor-pointer w-3.5 h-3.5 transition-colors"
                                />
                              </td>
                            )}

                            {renderedColumns.map((col) => {
                              const isPk = col.isPrimaryKey
                              const isEditing = editingCell?.rowIndex === rIdx && editingCell?.colName === col.name
                              const isFlashing = successFlashCell?.rowIndex === rIdx && successFlashCell?.colName === col.name
                              
                              const val = row[col.name]
                              let displayVal = val
                              if (val === null) {
                                  displayVal = <span className="text-white/20 italic">NULL</span>
                              } else if (typeof val === 'object') {
                                  displayVal = <span className="text-white/40 truncate block max-w-xs">{JSON.stringify(val)}</span>
                              } else if (typeof val === 'boolean') {
                                  displayVal = val ? <span className="text-emerald-400 font-bold">TRUE</span> : <span className="text-white/30">FALSE</span>
                              }

                              const colIdx = renderedColumns.findIndex(c => c.name === col.name)
                              const isRightHalf = colIdx >= renderedColumns.length / 2

                              const isSelected = selectedCell?.rowIndex === rIdx && selectedCell?.colName === col.name

                              return (
                                <td
                                  key={col.name}
                                  onClick={() => setSelectedCell({ rowIndex: rIdx, colName: col.name })}
                                  onDoubleClick={() => handleStartEdit(rIdx, col.name, val)}
                                  className={cn(
                                    "px-4 py-3 font-mono text-[11px] transition-all duration-300 relative group/cell",
                                    !isEditing && "max-w-xs truncate",
                                    isPk ? "text-accent font-semibold" : "text-white/80",
                                    isFlashing ? "bg-emerald-500/10 text-emerald-400 font-bold" : "",
                                    isSuperAdmin && !isPk ? "cursor-cell hover:bg-white/[0.015]" : "",
                                    isSelected ? "outline outline-2 outline-accent -outline-offset-2 z-20 relative" : "",
                                    isEditing ? "z-30" : ""
                                  )}
                                  title={isSuperAdmin && !isPk ? "Double-click to inline edit cell" : ""}
                                >
                                  {isSuperAdmin && !isPk && !isEditing && (
                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover/cell:opacity-100 transition-opacity cursor-pointer p-0.5 hover:bg-white/10 rounded text-accent z-10">
                                      <Edit3 className="w-3 h-3" onClick={() => handleStartEdit(rIdx, col.name, val)} />
                                    </span>
                                  )}

                                  {isEditing ? (
                                    <div className={cn(
                                      "absolute z-50 bg-[#0d0d11] border border-white/10 rounded-lg shadow-2xl p-3 min-w-[320px] flex flex-col gap-2 text-left",
                                      (rows.length === pageSize && rows.length - rIdx <= 2) ? "bottom-0" : "top-0",
                                      isRightHalf ? "right-0" : "left-0"
                                    )}>
                                      <div className="text-[10px] text-white/40 font-semibold uppercase flex items-center justify-between">
                                        <span>Edit {col.name}</span>
                                        <span className="text-[9px] text-white/25 lowercase font-mono">({col.type})</span>
                                      </div>
                                      <textarea
                                        value={editingValue}
                                        onChange={(e) => setEditingValue(e.target.value)}
                                        style={{ fontSize: `${editorFontSize}px` }}
                                        className="w-full h-24 bg-[#121217] border border-white/10 rounded p-2 font-mono text-white focus:outline-none focus:border-accent resize-y"
                                        autoFocus
                                        disabled={updatingCellProgress}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault()
                                            handleSaveCellEdit(row, col.name, rIdx)
                                          } else if (e.key === 'Escape') {
                                            e.preventDefault()
                                            setEditingCell(null)
                                          }
                                        }}
                                      />
                                      <div className="flex items-center justify-between mt-1 text-[10px]">
                                        <button
                                          type="button"
                                          onClick={() => handleSaveCellEdit(row, col.name, rIdx, true)}
                                          disabled={updatingCellProgress}
                                          className="px-2.5 py-1 bg-white/[0.02] border border-white/10 hover:bg-white/[0.05] rounded text-white/70 hover:text-white transition-colors cursor-pointer"
                                        >
                                          Set NULL
                                        </button>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => setEditingCell(null)}
                                            disabled={updatingCellProgress}
                                            className="px-2 py-1 hover:bg-white/5 rounded text-white/50 hover:text-white transition-colors cursor-pointer"
                                          >
                                            Cancel <span className="bg-white/10 px-1 rounded ml-0.5 text-[8px]">Esc</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleSaveCellEdit(row, col.name, rIdx)}
                                            disabled={updatingCellProgress}
                                            className="px-2.5 py-1 bg-accent text-[#0a0a0a] font-semibold hover:bg-accent/80 rounded transition-colors flex items-center gap-1 cursor-pointer"
                                          >
                                            Save <span className="bg-[#0a0a0a]/10 px-1 rounded text-[8px]">↵</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="pr-4 block truncate">{displayVal}</span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination footer bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 px-3 sm:px-4 py-3 border-t border-white/[0.06] bg-white/[0.005] rounded-xl shrink-0">
                <p className="text-[11px] text-[var(--color-text-muted)] font-medium font-mono">
                  {tableRowsCountEnabled ? (
                    <>Showing <span className="text-white">{rows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> – <span className="text-white">{Math.min(currentPage * pageSize, totalRecords)}</span> of <span className="text-white">{totalRecords}</span></>
                  ) : (
                    <>Showing <span className="text-white">{rows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</span> – <span className="text-white">{Math.min(currentPage * pageSize, (currentPage - 1) * pageSize + rows.length)}</span></>
                  )}
                </p>

                <div className="flex items-center gap-4">
                  {/* Rows selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[var(--color-text-muted)] font-medium">Rows</span>
                    <Select
                      aria-label="Rows per page"
                      value={String(pageSize)}
                      onChange={(v) => {
                        setPageSize(Number(v))
                        setCurrentPage(1)
                      }}
                      size="sm"
                      align="right"
                      placement="top"
                      className="w-16 font-mono"
                      options={[5, 10, 15, 20, 50].map((n) => ({ value: String(n), label: String(n) }))}
                    />
                  </div>

                  {/* Navigation buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1 || isLoadingData}
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-white/[0.02] border border-white/[0.06] text-white/50 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-medium text-white px-2 font-mono select-none">
                      {currentPage} / {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages || isLoadingData}
                      className="w-7 h-7 flex items-center justify-center rounded-md bg-white/[0.02] border border-white/[0.06] text-white/50 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ==================== INSERT RECORD MODAL ==================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#0a0a0c] border border-white/[0.06] rounded-xl max-w-lg w-full max-h-[80vh] flex flex-col overflow-hidden text-left shadow-2xl animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-white/[0.005]">
              <h3 className="text-sm font-medium text-white">Add new row in "{selectedTable}"</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleAddRecord} noValidate className="flex-grow overflow-y-auto p-6 space-y-4">
              <div className="space-y-4">
                {columns.map((col) => {
                  const isPk = col.isPrimaryKey
                  const hasDefault = !!col.defaultVal || isPk
                  const labelHint = isPk ? '(Primary Key - Auto)' : hasDefault ? `(Optional - Default: ${col.defaultVal || 'Auto'})` : col.nullable ? '(Optional)' : '(Required)'

                  return (
                    <div key={col.name} className="space-y-1.5 text-xs">
                      <label className="flex items-center justify-between font-mono font-medium text-white/70">
                        <span>{col.name}</span>
                        <span className="text-[10px] text-white/30 normal-case font-sans">{labelHint}</span>
                      </label>
                      <input
                        type="text"
                        placeholder={col.type}
                        value={newRecordData[col.name] || ''}
                        onChange={(e) => setNewRecordData(prev => ({ ...prev, [col.name]: e.target.value }))}
                        className="w-full h-9 bg-white/[0.02] border border-white/[0.06] rounded-lg px-3 text-xs text-white focus:outline-none focus:border-accent transition-colors"
                        required={!col.nullable && !hasDefault}
                        disabled={isPk}
                      />
                    </div>
                  )
                })}
              </div>

              {/* Form Footer Buttons */}
              <div className="pt-4 flex justify-end gap-2 border-t border-white/[0.04] mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="h-9 px-4 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-white/60 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <Button type="submit" disabled={isSubmittingRecord} className="h-9 px-4 text-xs font-semibold rounded-lg">
                  {isSubmittingRecord ? 'Inserting...' : 'Insert row'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- WRITE QUERY APPROVAL REQUEST CONFIRM MODAL --- */}
      {showRequestConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-300 font-sans">
          <div className="w-full max-w-md bg-[#0c0c0e] border border-white/[0.08] rounded-xl p-5 shadow-2xl relative text-left">
            <div className="space-y-4">
              <div className="border-b border-white/[0.06] pb-3">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>Write Permissions Required</span>
                </h3>
                <p className="text-xs text-white/40 mt-1">
                  This query contains database modification statements. You do not have direct write access.
                </p>
              </div>

              <div className="p-3 bg-black/40 border border-white/[0.04] rounded-lg max-h-36 overflow-y-auto font-mono text-[11px] text-[#a78bfa] whitespace-pre-wrap select-text">
                {lastExecutedQueryForRequest}
              </div>

              <p className="text-xs text-white/60">
                Would you like to submit this query as an approval request to the Super Admins?
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSubmittingRequest}
                  onClick={() => {
                    setShowRequestConfirmModal(false)
                    setLastExecutedQueryForRequest('')
                  }}
                  className="h-8 px-3.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-white/60 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmittingRequest}
                  onClick={handleSubmitRequest}
                  className="h-8 px-4 rounded-lg bg-accent text-[#0a0a0a] hover:bg-accent/80 transition-colors text-xs font-bold cursor-pointer"
                >
                  {isSubmittingRequest ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- SUPER ADMIN REJECTION REASON MODAL --- */}
      {showRejectionModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-300 font-sans">
          <div className="w-full max-w-md bg-[#0c0c0e] border border-white/[0.08] rounded-xl p-5 shadow-2xl relative text-left">
            <div className="space-y-4">
              <div className="border-b border-white/[0.06] pb-3">
                <h3 className="text-sm font-medium text-white">Reject Query Request</h3>
                <p className="text-xs text-white/40 mt-0.5">
                  Provide a reason for rejecting this database change request.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-white/30 uppercase font-semibold">Rejection Reason</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this change is rejected (e.g. incorrect table index, syntax, etc.)"
                  className="w-full h-20 bg-white/[0.02] border border-white/[0.06] rounded-lg p-2.5 text-xs text-white focus:outline-none focus:border-red-500/50 resize-none leading-relaxed"
                  spellCheck={false}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isReviewingRequest !== null}
                  onClick={() => {
                    setShowRejectionModal(null)
                    setRejectionReason('')
                  }}
                  className="h-8 px-3.5 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] transition-colors text-white/60 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isReviewingRequest !== null}
                  onClick={() => handleReviewRequest(showRejectionModal, 'reject', rejectionReason)}
                  className="h-8 px-4 rounded-lg bg-red-500 text-white hover:bg-red-400 transition-colors text-xs font-bold cursor-pointer"
                >
                  {isReviewingRequest !== null ? 'Rejecting...' : 'Reject Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
