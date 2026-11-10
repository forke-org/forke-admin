'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
  Archive, Briefcase, ChevronsUpDown, Code, HardDrive, History, KeyRound, LayoutDashboard,
  LineChart, LogOut, Mail, MessageSquare, PenSquare, Server, Shield, Table, Terminal, User, X, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

export type AdminTab =
  | 'dashboard' | 'owner-approval' | 'developer-ban' | 'enquiries' | 'admins' | 'subscribers' | 'tracker' | 'blogs'
  | 'changelog' | 'activity' | 'database' | 'buckets' | 'vm-overview' | 'sql-editor' | 'backups'

type Counts = {
  pendingOwners: number
  owners: number
  developers: number
  enquiries: number
  subscribers: number
  blogs: number
  changelogs: number
  tables: number
  admins: number
  pendingSqlRequests: number
}

type Admin = { name?: string; email?: string; username?: string; role?: string } | null

type Item = {
  tab: AdminTab
  label: string
  icon: LucideIcon
  count?: number
  alert?: number
  alertTone?: 'accent' | 'red'
  status?: { label: string; on: boolean }
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).join('').slice(0, 2).toUpperCase() || 'A'
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('grid shrink-0 place-items-center rounded-[6px] bg-gradient-to-br from-[#ffb25c] to-accent font-semibold text-[#1a0a00]', className)}>
      {initials(name)}
    </span>
  )
}

function Badge({ children, tone = 'accent' }: { children: React.ReactNode; tone?: 'accent' | 'red' | 'green' | 'neutral' }) {
  const tones = {
    accent: 'bg-accent/[0.12] text-[#FFA347]',
    red: 'bg-red-400/10 text-red-400',
    green: 'bg-emerald-400/10 text-emerald-400',
    neutral: 'bg-white/[0.06] text-[var(--color-text-muted)]',
  }
  return (
    <span className={cn('inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-[4px] px-1.5 text-xs font-medium', tones[tone])}>
      <span className="h-1.5 w-1.5 rounded-[1.5px] bg-current" />
      {children}
    </span>
  )
}

function NavItem({ item, active, onSelect }: { item: Item; active: boolean; onSelect: (tab: AdminTab) => void }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={() => onSelect(item.tab)}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-8 w-full cursor-pointer items-center gap-2.5 rounded-[6px] px-2.5 text-left text-[13.5px] transition-colors',
        active ? 'bg-[#262423] font-medium text-white' : 'text-[#c9c7c5] hover:bg-[var(--color-surface)] hover:text-white'
      )}
    >
      {active ? <span className="absolute -left-3 top-2 bottom-2 w-[2px] rounded-r-[2px] bg-accent" /> : null}
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-accent' : 'text-[var(--color-text-muted)] group-hover:text-[#c9c7c5]')} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.status ? (
        <span className={cn('flex items-center gap-1.5 font-mono text-[10.5px]', item.status.on ? 'text-emerald-400' : 'text-[#5f5c5a]')}>
          <span className={cn('h-1.5 w-1.5 rounded-[1.5px]', item.status.on ? 'bg-emerald-400' : 'bg-white/20')} />
          {item.status.label}
        </span>
      ) : item.alert ? (
        <span className={cn(
          'rounded-[4px] px-1.5 font-mono text-[10.5px] leading-5',
          item.alertTone === 'red' ? 'bg-red-400/10 text-red-400' : 'bg-accent/[0.12] text-[#FFA347]'
        )}>
          {item.alert}
        </span>
      ) : item.count !== undefined ? (
        <span className="font-mono text-[10.5px] text-[#5f5c5a] tabular-nums">{item.count}</span>
      ) : null}
    </button>
  )
}

function AccountMenu({ admin, onProfile, onPassword }: { admin: Admin; onProfile: () => void; onPassword: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const name = admin?.name || 'Admin'
  const role = admin?.role === 'super_admin' ? 'Super admin' : 'Admin'

  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('mousedown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const action = (fn: () => void) => () => { setOpen(false); fn() }
  const rowClass = 'flex w-full cursor-pointer items-center gap-2 rounded-[5px] px-2.5 py-2 text-left text-[13px] text-[#c9c7c5] hover:bg-[#262423] hover:text-white'

  return (
    <div className="relative" ref={ref}>
      {open ? (
        <div className={cn(
          'absolute bottom-full left-0 right-0 z-50 mb-2 overflow-hidden rounded-[8px] border border-[var(--color-border-strong)] bg-[var(--color-surface)] shadow-[0_24px_64px_-16px_rgba(0,0,0,0.7)] animate-in fade-in slide-in-from-bottom-1 duration-150'
        )}>
          <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[#1e1d1c] px-3 py-3">
            <Avatar name={name} className="h-9 w-9 text-xs" />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-white">{name}</div>
              <div className="truncate text-xs text-[var(--color-text-muted)]">{admin?.email || admin?.username || ''}</div>
            </div>
          </div>
          <div className="flex flex-col gap-2 border-b border-[var(--color-border)] px-3 py-3 text-xs">
            {admin?.username ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--color-text-muted)]">Username</span>
                <span className="truncate font-medium text-white">{admin.username}</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[var(--color-text-muted)]">Role</span>
              <Badge>{role}</Badge>
            </div>
          </div>
          <div className="p-1">
            <button type="button" onClick={action(onProfile)} className={rowClass}><User className="h-4 w-4" />Profile</button>
            <button type="button" onClick={action(onPassword)} className={rowClass}><KeyRound className="h-4 w-4" />Change password</button>
            <a href="/api/auth/logout" className={rowClass}><LogOut className="h-4 w-4" />Sign out</a>
          </div>
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full cursor-pointer items-center gap-2.5 rounded-[6px] p-1.5 text-left transition-colors hover:bg-[#262423]',
          open && 'bg-[#262423]'
        )}
      >
        <Avatar name={name} className="h-8 w-8 text-[11px]" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-white">{name}</span>
          <span className="block truncate text-[11.5px] text-[var(--color-text-muted)]">Forke · {role}</span>
        </span>
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
      </button>
    </div>
  )
}

export function AdminSidebar({
  activeTab, onSelect, mobileOpen, onCloseMobile, counts, approvals, approvalsFailed,
  activityLive, admin, onProfile, onPassword,
}: {
  activeTab: AdminTab | null
  onSelect: (tab: AdminTab) => void
  mobileOpen: boolean
  onCloseMobile: () => void
  counts: Counts
  approvals: number
  approvalsFailed: boolean
  activityLive: boolean
  admin: Admin
  onProfile: () => void
  onPassword: () => void
}) {
  const superAdmin = admin?.role === 'super_admin'
  const groups: { label: string | null; items: Item[] }[] = [
    { label: null, items: [{ tab: 'dashboard', label: 'Overview', icon: LayoutDashboard, alert: approvals || undefined, alertTone: approvalsFailed ? 'red' : 'accent' }] },
    {
      label: 'Users',
      items: [
        { tab: 'owner-approval', label: 'Owners', icon: Briefcase, alert: counts.pendingOwners || undefined, count: counts.owners },
        { tab: 'developer-ban', label: 'Developers', icon: Code, count: counts.developers },
      ],
    },
    {
      label: 'Content',
      items: [
        { tab: 'enquiries', label: 'Enquiries', icon: MessageSquare, alert: counts.enquiries || undefined, count: 0 },
        { tab: 'subscribers', label: 'Subscribers', icon: Mail, count: counts.subscribers },
        { tab: 'tracker', label: 'Tracker', icon: LineChart },
        { tab: 'blogs', label: 'Blog', icon: PenSquare, count: counts.blogs },
        { tab: 'changelog', label: 'Changelog', icon: History, count: counts.changelogs },
        { tab: 'activity', label: 'Activity', icon: Terminal, status: { label: activityLive ? 'Live' : 'Paused', on: activityLive } },
      ],
    },
    {
      label: 'Infrastructure',
      items: [
        { tab: 'vm-overview', label: 'VM Overview', icon: Server },
        { tab: 'database', label: 'Tables', icon: Table, count: counts.tables },
        { tab: 'buckets', label: 'Buckets', icon: HardDrive },
        { tab: 'backups', label: 'Backups', icon: Archive },
        ...(admin ? [{ tab: 'sql-editor' as const, label: 'SQL Editor', icon: Terminal, alert: superAdmin && counts.pendingSqlRequests ? counts.pendingSqlRequests : undefined }] : []),
        ...(superAdmin ? [{ tab: 'admins' as const, label: 'Admins', icon: Shield, count: counts.admins }] : []),
      ],
    },
  ]

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 flex h-screen shrink-0 select-none flex-col bg-[var(--color-bg)] transition-[width,transform] duration-300 lg:sticky',
        'lg:w-[240px]',
        mobileOpen ? 'w-[min(280px,85vw)] translate-x-0' : 'w-[min(280px,85vw)] -translate-x-full lg:translate-x-0'
      )}
    >
      <span aria-hidden className="rail-y pointer-events-none absolute inset-y-0 right-0 w-px" />
      <div className="relative flex h-14 shrink-0 items-center gap-2 px-5">
        <img src="/forke-assets/forke_logo.png" alt="" className="h-6 w-6 scale-[2] object-contain" />
        <span className="flex items-baseline gap-1.5 whitespace-nowrap text-[18px] tracking-[-0.04em]">
          <span className="font-semibold text-white">forke<span className="text-accent">*</span></span>
          <span className="font-normal text-[var(--color-text-muted)]">admin</span>
        </span>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="ml-auto grid h-8 w-8 cursor-pointer place-items-center rounded-[6px] text-[var(--color-text-muted)] hover:bg-[#262423] hover:text-white lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
        <span aria-hidden className="rail-x pointer-events-none absolute inset-x-0 bottom-0 h-px" />
      </div>

      <nav className="no-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {groups.map((group) => (
          <div key={group.label || 'root'} className="mb-4 last:mb-0">
            {group.label ? (
              <>
                <div className="px-2.5 pb-1.5 font-mono text-[10.5px] uppercase tracking-[0.08em] text-[#5f5c5a]">{group.label}</div>
              </>
            ) : null}
            <div className="flex flex-col gap-px">
              {group.items.map((item) => (
                <NavItem key={item.tab} item={item} active={activeTab === item.tab} onSelect={onSelect} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="relative px-3 pb-3 pt-3">
        <span aria-hidden className="rail-x pointer-events-none absolute inset-x-0 top-0 h-px" />
        <AccountMenu admin={admin} onProfile={onProfile} onPassword={onPassword} />
      </div>
    </aside>
  )
}
