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
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import { useSession } from 'next-auth/react'

export default function Navbar() {
  const router = useRouter()
  const { data: session } = useSession()
  const isLoggedIn = !!session?.user
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [hasSiteAccess, setHasSiteAccess] = useState(false)
  const [waitlistActive, setWaitlistActive] = useState(true)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)

    // Read helper cookies
    const getCookie = (name: string): string | null => {
      if (typeof document === 'undefined') return null
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift() || null
      return null
    }

    const siteAccess = getCookie('site_access_public') === 'true'
    const waitlist = getCookie('waitlist_active') === 'true'
    const animHandle = requestAnimationFrame(() => {
      setHasSiteAccess(siteAccess)
      setWaitlistActive(waitlist)
    })

    return () => {
      window.removeEventListener('scroll', handleScroll)
      cancelAnimationFrame(animHandle)
    }
  }, [])

  const showWaitlisterView = waitlistActive && !hasSiteAccess

  const navLinks = [
    { name: "What's Forke?", href: '/whats-forke' },
    { name: 'Levels', href: '/levels' },
    { name: 'Blogs', href: '/blogs' },
    { name: 'Contact Us', href: '/contact' },
  ]

  return (
    <nav className="fixed left-0 right-0 top-6 z-50 px-4 transition-all duration-300">
      <div className="w-full max-w-7xl mx-auto min-[1920px]:max-w-[1920px]">
        <div className={cn(
          "overflow-hidden border transition-all duration-300",
          isScrolled || isMobileMenuOpen
             ? "border-white/[0.12] bg-black/[0.5] backdrop-blur-3xl shadow-[0_12px_40px_rgba(0,0,0,0.6)]"
             : "border-white/[0.08] bg-black/[0.25] backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)]",
          isMobileMenuOpen ? "rounded-[28px]" : "rounded-[28px] lg:rounded-full"
        )}>
          {/* Main header row (always visible) */}
          <div className="flex justify-between items-center h-16 sm:h-[4.25rem] px-4 sm:px-7">
            <Link href="/" className="flex items-center gap-2 group shrink-0 relative pt-2">
              <div className="absolute -top-[20px] sm:-top-[26px] -left-3 sm:-left-4 w-[120px] sm:w-[150px] h-[72px] sm:h-[92px] z-20 pointer-events-none">
                <Image
                  src="/forke-assets/nav_peeking_forky.png"
                  alt="Forke Logo"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="w-[100px] sm:w-[130px] h-[40px] " /> {/* Spacer for the absolute mascot */}
              <span className="text-2xl sm:text-[1.75rem] font-semibold tracking-[-0.04em] text-white -ml-4 sm:-ml-6 relative z-10">
                forke<span className="text-accent">*</span>
              </span>
            </Link>

            {/* Center: Navigation Links */}
            <div className="hidden lg:flex items-center gap-8 absolute left-1/2 -translate-x-1/2">
              {navLinks.map((link) => (
                <Link
                  key={link.name}
                  href={link.href}
                  className="group/link font-mono text-[12.5px] lowercase text-white/55 hover:text-white transition-colors"
                >
                  <span className="text-accent/0 group-hover/link:text-accent/80 transition-colors">/</span>{link.name.replace(/[?'’]/g, '').replace(/\s+/g, '-').toLowerCase()}
                </Link>
              ))}
            </div>
            
            {/* Right: CTA Section */}
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              {showWaitlisterView ? (
                <Button 
                  variant="primary" 
                  className="hidden lg:inline-flex rounded-full px-5 py-2 h-auto text-[13px] font-semibold tracking-tight bg-accent hover:bg-accent-hover text-[#0a0a0a] shadow-none transition-colors"
                  onClick={() => router.push('/waitlist')}
                >
                  Join the waitlist
                </Button>
              ) : isLoggedIn ? (
                <Button 
                  variant="primary" 
                  className="hidden lg:inline-flex rounded-full px-5 py-2 h-auto text-[13px] font-semibold tracking-tight bg-accent hover:bg-accent-hover text-[#0a0a0a] shadow-none transition-colors" 
                  onClick={() => router.push('/dashboard')}
                >
                  Dashboard
                </Button>
              ) : (
                <Button 
                  variant="primary" 
                  className="hidden lg:inline-flex rounded-full px-5 py-2 h-auto text-[13px] font-semibold tracking-tight bg-accent hover:bg-accent-hover text-[#0a0a0a] shadow-none transition-colors" 
                  onClick={() => router.push('/signin')}
                >
                  Get Started
                </Button>
              )}

              {/* Mobile Menu Button */}
              <div className="lg:hidden flex items-center">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="relative w-10 h-10 flex flex-col items-center justify-center gap-[5px] rounded-lg hover:bg-white/5 transition-colors"
                  aria-label="Menu"
                >
                  <span
                    className={`block h-[1.5px] w-5 bg-white transition-all duration-300 ${isMobileMenuOpen ? 'translate-y-[6.5px] rotate-45' : ''}`}
                  />
                  <span
                    className={`block h-[1.5px] w-5 bg-white transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`}
                  />
                  <span
                    className={`block h-[1.5px] w-5 bg-white transition-all duration-300 ${isMobileMenuOpen ? '-translate-y-[6.5px] -rotate-45' : ''}`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Mobile menu expanded content (Design 5: Capsule Expand) */}
          <div className={cn(
            "lg:hidden grid transition-all duration-300",
            isMobileMenuOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}>
            <div className="overflow-hidden">
              <div className="px-5 pb-5 pt-2 flex flex-col gap-2">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="block rounded-xl px-3 py-2.5 text-[15px] text-white/70 hover:bg-white/[0.05] hover:text-white transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.name}
                  </Link>
                ))}
                <div className="px-1 pt-2">
                  {showWaitlisterView ? (
                    <Button 
                      variant="primary" 
                      className="w-full h-11 rounded-xl bg-accent hover:bg-accent-hover text-[#0a0a0a] text-[14px] font-semibold tracking-tight shadow-none transition-colors"
                      onClick={() => { setIsMobileMenuOpen(false); router.push('/waitlist'); }}
                    >
                      Join the waitlist
                    </Button>
                  ) : isLoggedIn ? (
                    <Button 
                      variant="primary" 
                      className="w-full h-11 rounded-xl bg-accent hover:bg-accent-hover text-[#0a0a0a] text-[14px] font-semibold tracking-tight shadow-none transition-colors" 
                      onClick={() => { setIsMobileMenuOpen(false); router.push('/dashboard'); }}
                    >
                      Dashboard
                    </Button>
                  ) : (
                    <Button 
                      variant="primary" 
                      className="w-full h-11 rounded-xl bg-accent hover:bg-accent-hover text-[#0a0a0a] text-[14px] font-semibold tracking-tight shadow-none transition-colors" 
                      onClick={() => { setIsMobileMenuOpen(false); router.push('/signin'); }}
                    >
                      Get Started
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}
