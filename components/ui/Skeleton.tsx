/**
 * @fileoverview Forke Platform
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 *
 * Source-Available License (Non-Commercial / Fair Source).
 * This source code is open for inspection, learning, and personal development.
 * Commercial use, hosting, or resale as a paid service without an explicit
 * commercial license from Forke Inc. is strictly prohibited.
 */

import React from 'react'
import { cn } from '@/lib/utils/cn'

// 1. Core Reusable Shimmer Block (#7 shimmer sweep)
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "skeleton-shimmer rounded-md bg-white/[0.02] border border-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.01)]",
        className
      )}
      {...props}
    />
  )
}

// 2. Specific Page Skeletons

// A. Overview Page Skeleton
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[#060608] text-white">
      {/* Top Bar Skeleton */}
      <div className="h-14 border-b border-white/[0.06] flex items-center px-8 justify-between shrink-0">
        <Skeleton className="h-4 w-28" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>

      <div className="flex-grow overflow-y-auto px-5 md:px-8 py-6 md:py-8 space-y-6 max-w-6xl mx-auto w-full">
        {/* Page Header */}
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-4 space-y-3">
              <div className="flex justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3.5 w-3.5" />
              </div>
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-2.5 w-20" />
            </div>
          ))}
        </div>

        {/* Main Grid split pane */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left panel */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex justify-between items-center">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 flex gap-4">
                <Skeleton className="h-12 w-12 rounded-lg shrink-0" />
                <div className="space-y-2 flex-grow">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-5 w-12 rounded" />
                    <Skeleton className="h-5 w-16 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right panel */}
          <div className="lg:col-span-4 space-y-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-4 space-y-4">
              <Skeleton className="h-4 w-28" />
              <hr className="border-white/[0.06]" />
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex justify-between items-center py-1">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3.5 w-16" />
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-4 space-y-3">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-8 w-24 rounded-lg mt-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// B. Tasks Page Skeleton
export function TasksSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[#060608] text-white">
      <div className="h-14 border-b border-white/[0.06] flex items-center px-8 shrink-0">
        <Skeleton className="h-4 w-20" />
      </div>

      <div className="flex-grow overflow-y-auto px-5 md:px-8 py-6 max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex justify-between items-end">
          <div className="space-y-2">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-9 w-28 rounded-lg" />
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-white/[0.06] bg-white/[0.01]">
          <div className="flex items-center gap-3 flex-grow max-w-md">
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>

        {/* Feed count and columns */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-28" />
        </div>

        {/* Tasks List */}
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 flex justify-between items-start gap-4">
              <div className="space-y-2 flex-grow text-left">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-16 rounded" />
                </div>
                <Skeleton className="h-3 w-4/5" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex gap-2 pt-3">
                  <Skeleton className="h-5 w-12 rounded" />
                  <Skeleton className="h-5 w-12 rounded" />
                  <Skeleton className="h-5 w-16 rounded" />
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-8 w-24 rounded-lg mt-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// C. Submissions Page Skeleton
export function SubmissionsSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[#060608] text-white">
      <div className="h-14 border-b border-white/[0.06] flex items-center px-8 shrink-0">
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex-grow overflow-y-auto px-5 md:px-8 py-6 max-w-6xl mx-auto w-full space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-60" />
        </div>
        {/* Tabs skeleton */}
        <div className="flex border-b border-white/[0.06] gap-6">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
        {/* Submissions items */}
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-6 w-20 rounded" />
              </div>
              <Skeleton className="h-3 w-full" />
              <div className="flex justify-between items-center pt-2 border-t border-white/[0.04]">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-24 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// D. Chat Console Skeleton
export function MessagesSkeleton() {
  return (
    <div className="flex h-full bg-[#060608] text-white">
      {/* Sidebar conversasion list */}
      <div className="w-80 border-r border-white/[0.06] flex flex-col shrink-0">
        <div className="h-14 border-b border-white/[0.06] flex items-center px-5 shrink-0">
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="p-3 shrink-0">
          <Skeleton className="h-9 w-full rounded-lg" />
        </div>
        <div className="flex-grow overflow-y-auto p-2 space-y-1">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-3 p-3 rounded-lg border border-transparent bg-white/[0.005]">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="space-y-1.5 flex-grow min-w-0">
                <div className="flex justify-between">
                  <Skeleton className="h-3.5 w-16" />
                  <Skeleton className="h-2.5 w-8" />
                </div>
                <Skeleton className="h-3 w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main chat window */}
      <div className="flex-grow flex flex-col min-w-0">
        <div className="h-14 border-b border-white/[0.06] flex items-center px-6 justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-28" />
          </div>
        </div>
        {/* Messages body */}
        <div className="flex-grow p-6 space-y-4 overflow-y-auto flex flex-col justify-end">
          <div className="flex gap-3 max-w-sm">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.018] space-y-1.5 flex-grow">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
          <div className="flex gap-3 max-w-sm ml-auto justify-end">
            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.04] space-y-1.5 flex-grow">
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <div className="flex gap-3 max-w-sm">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.018] space-y-1.5 flex-grow">
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        </div>
        {/* Input box */}
        <div className="p-4 border-t border-white/[0.06] shrink-0 flex gap-2">
          <Skeleton className="h-9 flex-grow rounded-lg" />
          <Skeleton className="h-9 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

// E. Earnings Page Skeleton
export function EarningsSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[#060608] text-white">
      <div className="h-14 border-b border-white/[0.06] flex items-center px-8 shrink-0">
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex-grow overflow-y-auto px-5 md:px-8 py-6 max-w-6xl mx-auto w-full space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-5 space-y-3">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] p-5 space-y-4">
          <Skeleton className="h-4.5 w-32" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex justify-between items-center py-2">
              <div className="space-y-1">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-2.5 w-24" />
              </div>
              <Skeleton className="h-3.5 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// F. Profile / Company Profile Skeleton
export function ProfileSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[#060608] text-white">
      <div className="h-14 border-b border-white/[0.06] flex items-center px-8 shrink-0">
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex-grow overflow-y-auto px-5 md:px-8 py-6 max-w-3xl mx-auto w-full space-y-6 text-left">
        <div className="flex items-center gap-4 pb-6 border-b border-white/[0.06]">
          <Skeleton className="h-16 w-16 rounded-full shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-3.5 w-48" />
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-10 w-24 rounded-lg pt-4" />
        </div>
      </div>
    </div>
  )
}

// G. Settings Skeleton
export function SettingsSkeleton() {
  return <ProfileSkeleton />
}

// H. Support Skeleton
export function SupportSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[#060608] text-white">
      <div className="h-14 border-b border-white/[0.06] flex items-center px-8 shrink-0">
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex-grow overflow-y-auto px-5 md:px-8 py-6 max-w-xl mx-auto w-full space-y-5 text-left">
        <div className="space-y-2">
          <Skeleton className="h-5.5 w-32" />
          <Skeleton className="h-3.5 w-60" />
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-16" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          </div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-10 w-full rounded-lg mt-3" />
        </div>
      </div>
    </div>
  )
}

// I. Admin Panel Skeleton — full-panel loading state for admin console panels.
export function PanelSkeleton() {
  return (
    <div className="flex-grow flex flex-col min-h-[400px] bg-[#070709] p-6 space-y-6">
      {/* Toolbar row */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
      {/* Stat row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/[0.06] bg-white/[0.018] p-4 space-y-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
      {/* Table / body rows */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] divide-y divide-white/[0.04]">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
            <Skeleton className="h-3.5 w-1/4" />
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3.5 w-16 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Generic Fallback Loader
export function GenericPageSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[#060608] text-white p-8 space-y-6">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-64" />
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  )
}
