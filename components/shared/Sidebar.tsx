'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { 
  LayoutDashboard, 
  ClipboardList,
  FileCheck, 
  Users,
  ShieldCheck,
  BarChart3,
  Mail,
  Building2,
  Settings,
  Headphones,
  ChevronLeft, 
  ChevronRight, 
  LogOut,
  X,
  Plus,
  Wallet,
  User
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { signOut } from 'next-auth/react'
import { useDashboard } from '@/components/dashboard/DashboardContext'
import { XpBar } from '@/components/ui/XpBar'
import { getLevelTitle } from '@/lib/utils/xp'

interface SidebarProps {
  user: {
    name?: string | null
    email?: string | null
    image?: string | null
    level?: number
    xp?: number
    currentStreak?: number
    role?: 'developer' | 'owner'
    companyName?: string
  }
  pendingSubmissionsCount?: number
}

const OWNER_LEVEL_TITLES: Record<number, string> = {
  1: 'Initiator',
  2: 'Vanguard',
  3: 'Patron',
  4: 'Pioneer',
  5: 'Director',
  6: 'Strategist',
  7: 'Founder',
  8: 'Venture Partner',
  9: 'Titan',
  10: 'Syndicate',
  11: 'Sovereign',
}

export default function Sidebar({ user, pendingSubmissionsCount = 0 }: SidebarProps) {
  const pathname = usePathname()
  const { isMobileOpen, setIsMobileOpen, isCollapsed, setIsCollapsed } = useDashboard()

  const toggleSidebar = () => setIsCollapsed(!isCollapsed)
  const isOwner = user.role === 'owner'
  const levelTitle = isOwner 
    ? (OWNER_LEVEL_TITLES[user.level || 1] ?? 'Owner') 
    : getLevelTitle(user.level || 1)

  const links = isOwner ? [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Tasks', href: '/tasks', icon: ClipboardList },
    { label: 'Submissions', href: '/submissions', icon: FileCheck, badge: pendingSubmissionsCount },
    { label: 'Developers', href: '/developers', icon: Users },
    { label: 'Escrow', href: '/escrow', icon: ShieldCheck },
    { label: 'Analytics', href: '/analytics', icon: BarChart3 },
    { label: 'Messages', href: '/messages', icon: Mail, badge: 1 },
    { label: 'Company Profile', href: '/profile', icon: Building2 },
    { label: 'Settings', href: '/settings', icon: Settings },
  ] : [
    { label: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Tasks', href: '/tasks', icon: ClipboardList },
    { label: 'Submissions', href: '/submissions', icon: FileCheck },
    { label: 'Earnings', href: '/earnings', icon: Wallet },
    { label: 'Profile', href: '/profile', icon: User },
    { label: 'Settings', href: '/settings', icon: Settings },
  ]

  return (
    <>
      {/* Backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside 
        className={cn(
          "fixed md:sticky top-0 left-0 z-50 h-screen bg-[#070709] border-r border-white/[0.05] transition-all duration-350 flex flex-col shadow-2xl md:shadow-none select-none",
          isCollapsed ? "w-20" : "w-64",
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Top: Logo & Mobile Close */}
        <div className="h-20 flex items-center justify-between px-6 border-b border-white/[0.04] relative">
          <Link href="/dashboard" className="flex items-center gap-2 overflow-hidden whitespace-nowrap">
            <span className="font-serif text-2xl text-white tracking-wide">
              F<span className={cn("transition-all duration-300", isCollapsed ? "opacity-0 max-w-0" : "opacity-100 max-w-[200px]")}>ork<span className="text-accent italic">e</span></span>
            </span>
          </Link>
          <button 
            className="md:hidden p-1.5 text-white/40 hover:text-white transition-colors"
            onClick={() => setIsMobileOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Premium top subtle accent line */}
          <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
        </div>

        {/* Middle: Navigation */}
        <nav className="flex-grow py-6 px-4 space-y-1.5 overflow-y-auto">
          {links.map((link) => {
            const isActive = pathname === link.href
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setIsMobileOpen(false)}
                className={cn(
                  "flex items-center justify-between px-3 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden text-xs font-bold uppercase tracking-wider",
                  isActive 
                    ? "bg-gradient-to-r from-accent/15 to-accent/[0.01] text-accent border border-accent/15 shadow-[0_4px_20px_rgba(255,122,0,0.03)] pl-4 before:absolute before:left-0 before:top-2.5 before:bottom-2.5 before:w-[3px] before:bg-accent before:rounded-r-full" 
                    : "text-white/40 hover:bg-white/[0.02] hover:text-white pl-4",
                  isCollapsed ? "md:justify-center" : "justify-between"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("w-4.5 h-4.5 shrink-0 transition-transform duration-300 group-hover:scale-105", isActive ? "text-accent" : "text-white/30 group-hover:text-accent")} />
                  <span className={cn(
                    "transition-all duration-300",
                    isCollapsed ? "md:opacity-0 md:w-0" : "opacity-100"
                  )}>
                    {link.label}
                  </span>
                </div>

                {/* Badge if present */}
                {link.badge !== undefined && link.badge > 0 && !isCollapsed && (
                  <span className="px-2 py-0.5 text-[8.5px] font-black font-mono rounded-full bg-accent/20 border border-accent/30 text-accent leading-none">
                    {link.badge}
                  </span>
                )}

                {/* Desktop Tooltip when collapsed */}
                {isCollapsed && (
                  <div className="hidden md:block absolute left-16 bg-[#0c0c0e] border border-white/10 text-white text-[9px] font-black tracking-widest uppercase px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 pointer-events-none z-50 shadow-xl">
                    {link.label}
                  </div>
                )}
              </Link>
            )
          })}

          {/* "Post New Task" prominent button for owners */}
          {isOwner && (
            <Link 
              href="/post-task"
              className={cn(
                "mt-4 flex items-center gap-2 rounded-xl bg-gradient-to-b from-accent to-[#d97706] hover:translate-y-[1px] hover:shadow-[0_4px_15px_rgba(255,122,0,0.2)] transition-all text-[#050505] font-black uppercase tracking-widest text-[9px] cursor-pointer relative group",
                isCollapsed ? "md:justify-center py-3 px-3" : "w-full justify-center py-3 px-4"
              )}
            >
              <Plus className="w-4 h-4 stroke-[3px] shrink-0" />
              <span className={cn("transition-all duration-300", isCollapsed ? "md:opacity-0 md:w-0 overflow-hidden" : "opacity-100")}>Post New Task</span>
              {isCollapsed && (
                <div className="hidden md:block absolute left-16 bg-[#0c0c0e] border border-accent/20 text-accent text-[9px] font-black tracking-widest uppercase px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 translate-x-2 group-hover:translate-x-0 pointer-events-none z-50 shadow-xl whitespace-nowrap">
                  Post New Task
                </div>
              )}
            </Link>
          )}
        </nav>

        {/* Support Section */}
        {!isCollapsed && (
          <div className="px-4 mb-4">
            <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/[0.03] text-left">
              <h5 className="text-[10px] font-black text-white uppercase tracking-wider">Need help?</h5>
              <p className="text-[9px] text-white/40 mt-1 leading-relaxed">Our support team is available 24/7</p>
              <Link 
                href="/support" 
                className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-white/5 hover:border-accent/40 text-white/60 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest bg-white/[0.01]"
              >
                <Headphones className="w-3.5 h-3.5" /> Contact Support
              </Link>
            </div>
          </div>
        )}

        {/* Bottom: User Card & Toggle */}
        <div className="p-4 border-t border-white/[0.04] bg-white/[0.005] relative">
          <div className="flex items-center gap-3.5 mb-3 min-h-[40px] p-2 rounded-2xl bg-white/[0.01] border border-white/[0.03]">
            {/* Avatar */}
            <div className={cn(
              "w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-accent/10 flex items-center justify-center border border-accent/20 relative shadow-[0_0_12px_rgba(255,122,0,0.08)]",
              isOwner ? "ring-2 ring-accent/30 ring-offset-2 ring-offset-[#070709]" : ""
            )}>
              {user.image ? (
                <Image src={user.image} alt={user.name || ''} fill className="object-cover" />
              ) : (
                <span className="text-xs font-mono text-accent font-bold">
                  {user.name?.[0]?.toUpperCase()}
                </span>
              )}
            </div>
          
            {/* Name + level (only show when expanded) */}
            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-in fade-in slide-in-from-left-2 duration-300 text-left">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-black text-white truncate leading-none">
                    {isOwner ? (user.companyName || 'Acme Labs') : user.name?.split(' ')[0]}
                  </p>
                  {isOwner && (
                    <span className="inline-block w-3.5 h-3.5 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-[7px] text-accent font-bold">✓</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[8.5px] text-white/40 truncate font-black uppercase tracking-wider">
                    {isOwner ? 'Starter Plan' : levelTitle}
                  </span>
                  {!isOwner && (
                    <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded bg-accent text-[#050505] leading-none uppercase">
                      Lvl {user.level}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          
          {/* XP bar — only show in expanded sidebar for developers */}
          {!isCollapsed && !isOwner && (
            <div className="mb-4 px-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-150">
              <XpBar totalXp={user.xp ?? 0} compact />
            </div>
          )}
          
          {/* Streak badge — show if streak > 1 */}
          {!isCollapsed && (user.currentStreak ?? 0) > 1 && (
            <div className="flex items-center justify-between mb-4 px-2 py-1.5 rounded-xl bg-accent/[0.02] border border-accent/10 animate-in fade-in duration-700 delay-300">
              <span className="text-[8.5px] text-white/50 font-black uppercase tracking-wider">
                {user.currentStreak} Day Streak
              </span>
              {/* Flame dots — one per milestone hit */}
              <div className="flex gap-1">
                {[2, 5, 7, 14, 30].map((m) => (
                  <div
                    key={m}
                    className={cn(
                      'w-1.5 h-1.5 rounded-full ring-1 ring-offset-0',
                      (user.currentStreak ?? 0) >= m
                        ? 'bg-accent ring-accent/30 shadow-[0_0_6px_var(--color-accent)]'
                        : 'bg-white/10 ring-transparent'
                    )}
                  />
                ))}
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/[0.04]">
            <button 
              onClick={() => signOut({ callbackUrl: '/' })}
              className={cn(
                "flex items-center gap-2 px-2 py-2 text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-red-400 transition-colors cursor-pointer",
                isCollapsed ? "justify-center w-full" : "justify-start"
              )}
            >
              <LogOut className="w-3.5 h-3.5" />
              {!isCollapsed && <span>Sign Out</span>}
            </button>

            {/* Collapse Toggle (Desktop only) */}
            <button 
              onClick={toggleSidebar}
              className="hidden md:flex items-center justify-center p-2 text-white/30 hover:text-white hover:bg-white/[0.02] rounded-xl transition-colors cursor-pointer"
            >
              {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
