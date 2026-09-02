'use client'

/**
 * @fileoverview Forke Platform - Email Sneak Peek Modal
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 */

import React, { useEffect, useMemo } from 'react'
import { X, Send, Loader2 } from 'lucide-react'

interface EmailSneakPeekModalProps {
  isOpen: boolean
  onClose: () => void
  subject: string
  html: string
  loading?: boolean
  audienceCount?: number
  onApprove?: () => void
  approving?: boolean
}

export default function EmailSneakPeekModal({
  isOpen,
  onClose,
  subject,
  html,
  loading = false,
  onApprove,
  approving = false,
}: EmailSneakPeekModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    } else {
      document.body.style.overflow = 'auto'
    }
    return () => {
      document.body.style.overflow = 'auto'
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Injects styles so the email card perfectly shrinks to 100% viewport on all devices without clipping
  const responsiveHtml = useMemo(() => {
    if (!html) return ''

    const responsiveStyle = `
      <style>
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: 100% !important;
          min-width: 100% !important;
          max-width: 100% !important;
          box-sizing: border-box !important;
          overflow-x: hidden !important;
        }
        *, *::before, *::after {
          box-sizing: border-box !important;
        }
        table {
          box-sizing: border-box !important;
        }
        img:not(.social-icon-img) {
          max-width: 100% !important;
          height: auto !important;
          display: block !important;
        }
        .social-icon-img {
          display: block !important;
          margin: 0 auto !important;
          width: 18px !important;
          height: 18px !important;
          max-width: 18px !important;
          max-height: 18px !important;
        }
        /* Constrain outer table & canvas cell */
        .email-outer-td,
        td[style*="padding:52px 16px"],
        td[style*="padding: 52px 16px"] {
          padding: 16px 8px !important;
        }
        /* Constrain card table to fit within screen */
        .email-card-table,
        table[width="600"],
        table[style*="max-width:600px"],
        table[style*="max-width: 600px"] {
          width: 100% !important;
          max-width: 100% !important;
          border-radius: 16px !important;
          table-layout: fixed !important;
        }
        /* Adjust cell padding for mobile */
        .email-header-td,
        td[style*="padding:22px 32px"],
        td[style*="padding: 22px 32px"] {
          padding: 14px 14px !important;
        }
        .email-body-td,
        td[style*="padding:40px 32px"],
        td[style*="padding: 40px 32px"] {
          padding: 20px 14px !important;
        }
        .email-media-td,
        td[style*="padding:0 24px"],
        td[style*="padding: 0 24px"] {
          padding: 0 12px !important;
        }
        .email-footer-td,
        td[style*="padding:24px 32px 30px 32px"],
        td[style*="padding: 24px 32px 30px 32px"] {
          padding: 18px 14px !important;
        }
        .email-highlights-col {
          display: block !important;
          width: 100% !important;
          box-sizing: border-box !important;
          padding: 10px 12px !important;
        }
        .email-headline, h1 {
          font-size: 20px !important;
          line-height: 1.25 !important;
          word-break: break-word !important;
        }
        p, span, a, li {
          word-break: break-word !important;
        }
      </style>
    `
    if (html.includes('</head>')) {
      return html.replace('</head>', `${responsiveStyle}</head>`)
    }
    return `${responsiveStyle}${html}`
  }, [html])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/65 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[94vh] rounded-xl sm:rounded-2xl border border-white/10 bg-[#08080a] shadow-[0_24px_80px_rgba(0,0,0,0.8)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Window Bar: Subject + Actions (Uniform Height & Style) */}
        <div className="shrink-0 flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-white/[0.08] bg-white/[0.02] gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-xs sm:text-sm font-semibold text-white truncate tracking-tight">
              {subject || 'Email Preview'}
            </h3>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onApprove && (
              <button
                type="button"
                disabled={approving || loading}
                onClick={onApprove}
                className="h-8 min-h-[32px] max-h-[32px] px-3.5 rounded-lg border border-white bg-white text-black text-xs font-medium hover:bg-white/90 hover:border-white/90 transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-sm cursor-pointer shrink-0 box-border leading-none"
              >
                {approving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                    <span className="hidden sm:inline leading-none">Broadcasting…</span>
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5 shrink-0" />
                    <span className="leading-none">Approve</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="h-8 w-8 min-h-[32px] max-h-[32px] min-w-[32px] max-w-[32px] rounded-lg border border-white/10 bg-white/[0.03] text-white/50 hover:text-white hover:bg-white/[0.08] hover:border-white/20 transition-colors flex items-center justify-center cursor-pointer shrink-0 box-border leading-none p-0"
              title="Close Preview"
            >
              <X className="h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>

        {/* Modal Body: exact HTML rendering with guaranteed full visibility */}
        <div className="flex-grow min-h-0 overflow-hidden bg-[#050505] flex items-center justify-center relative p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-accent mb-2.5" />
              <p className="text-xs font-mono text-white/50">Compiling exact email template…</p>
            </div>
          ) : (
            <iframe
              srcDoc={responsiveHtml}
              title="Email Preview"
              className="w-full h-[72vh] sm:h-[78vh] border-0 bg-[#050505] overflow-x-hidden"
              sandbox="allow-same-origin"
            />
          )}
        </div>
      </div>
    </div>
  )
}
