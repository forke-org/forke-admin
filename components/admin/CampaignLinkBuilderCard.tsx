'use client'

/**
 * @fileoverview Forke Platform - 1-Click UTM Campaign Link Builder
 * @copyright (c) 2026 Forke Inc. (https://www.forke.space/)
 */

import React, { useState, useMemo } from 'react'
import { Link2, Copy, Check, ExternalLink, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface ChannelPreset {
  id: string
  label: string
  source: string
  medium: string
  badgeColor?: string
}

const CHANNEL_PRESETS: ChannelPreset[] = [
  { id: 'twitter', label: 'Twitter / X', source: 'twitter', medium: 'social' },
  { id: 'linkedin', label: 'LinkedIn', source: 'linkedin', medium: 'social' },
  { id: 'whatsapp', label: 'WhatsApp', source: 'whatsapp', medium: 'social' },
  { id: 'telegram', label: 'Telegram', source: 'telegram', medium: 'social' },
  { id: 'discord', label: 'Discord', source: 'discord', medium: 'social' },
  { id: 'reddit', label: 'Reddit', source: 'reddit', medium: 'social' },
  { id: 'producthunt', label: 'ProductHunt', source: 'producthunt', medium: 'referral' },
  { id: 'email', label: 'Newsletter', source: 'newsletter', medium: 'email' },
]

const DESTINATION_PRESETS = [
  { label: 'Home (/)', path: '/' },
  { label: "What's Forke", path: '/whats-forke' },
  { label: 'Levels & Unlocks', path: '/levels' },
  { label: 'Waitlist', path: '/waitlist' },
  { label: 'Blog Feed', path: '/blogs' },
  { label: 'Documentation', path: '/docs' },
]

export default function CampaignLinkBuilderCard() {
  const [selectedChannel, setSelectedChannel] = useState<string>('twitter')
  const [customSource, setCustomSource] = useState('')
  const [customMedium, setCustomMedium] = useState('')
  const [selectedDest, setSelectedDest] = useState<string>('/')
  const [customPath, setCustomPath] = useState('')
  const [campaign, setCampaign] = useState('')
  const [copied, setCopied] = useState(false)

  const activeChannel = useMemo(() => {
    return CHANNEL_PRESETS.find((c) => c.id === selectedChannel)
  }, [selectedChannel])

  const resolvedSource = useMemo(() => {
    if (selectedChannel === 'custom') {
      return customSource.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '') || 'direct'
    }
    return activeChannel?.source || 'direct'
  }, [selectedChannel, customSource, activeChannel])

  const resolvedMedium = useMemo(() => {
    if (selectedChannel === 'custom') {
      return customMedium.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '') || 'social'
    }
    return activeChannel?.medium || 'social'
  }, [selectedChannel, customMedium, activeChannel])

  const resolvedPath = useMemo(() => {
    if (selectedDest === 'custom') {
      const p = customPath.trim()
      if (!p) return '/'
      return p.startsWith('/') ? p : `/${p}`
    }
    return selectedDest
  }, [selectedDest, customPath])

  const generatedUrl = useMemo(() => {
    const base = 'https://forke.space'
    const url = new URL(resolvedPath, base)
    
    if (resolvedSource && resolvedSource !== 'direct') {
      url.searchParams.set('source', resolvedSource)
      url.searchParams.set('utm_source', resolvedSource)
    }
    if (resolvedMedium) {
      url.searchParams.set('utm_medium', resolvedMedium)
    }
    const cleanCamp = campaign.toLowerCase().trim().replace(/[^a-z0-9_-]/g, '')
    if (cleanCamp) {
      url.searchParams.set('utm_campaign', cleanCamp)
    }
    return url.toString()
  }, [resolvedPath, resolvedSource, resolvedMedium, campaign])

  const handleCopy = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(generatedUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="rounded-xl bg-white/[0.018] border border-[var(--color-border)] p-5 relative overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-medium text-white">1-Click Campaign Link Builder</h3>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Eliminates desktop &ldquo;direct&rdquo; traffic by generating standardized, tracked campaign links.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-accent/90 bg-accent/10 border border-accent/20 px-2 py-0.5 rounded-full w-fit">
          <Sparkles className="h-3 w-3" /> Auto-Attributed
        </span>
      </div>

      <div className="space-y-4">
        {/* Step 1: Channel Presets */}
        <div>
          <label className="block text-[11px] font-mono text-white/60 mb-2 uppercase tracking-wider">
            1. Select Marketing Channel
          </label>
          <div className="flex flex-wrap gap-1.5">
            {CHANNEL_PRESETS.map((p) => {
              const isSelected = selectedChannel === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedChannel(p.id)}
                  className={cn(
                    'text-xs font-mono px-3 py-1.5 rounded-lg border transition-all cursor-pointer',
                    isSelected
                      ? 'bg-accent/15 border-accent text-white font-medium shadow-[0_0_12px_rgba(255,107,0,0.15)]'
                      : 'bg-white/[0.02] border-[var(--color-border)] text-white/70 hover:text-white hover:bg-white/[0.05]'
                  )}
                >
                  {p.label}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setSelectedChannel('custom')}
              className={cn(
                'text-xs font-mono px-3 py-1.5 rounded-lg border transition-all cursor-pointer',
                selectedChannel === 'custom'
                  ? 'bg-accent/15 border-accent text-white font-medium'
                  : 'bg-white/[0.02] border-[var(--color-border)] text-white/70 hover:text-white hover:bg-white/[0.05]'
              )}
            >
              Custom...
            </button>
          </div>

          {selectedChannel === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/[0.06]">
              <div>
                <span className="text-[10px] font-mono text-white/50 block mb-1">Source (e.g. hackernews)</span>
                <input
                  type="text"
                  placeholder="source slug"
                  value={customSource}
                  onChange={(e) => setCustomSource(e.target.value)}
                  className="w-full text-xs font-mono bg-black/40 border border-[var(--color-border)] rounded-md px-2.5 py-1.5 text-white focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <span className="text-[10px] font-mono text-white/50 block mb-1">Medium (e.g. forum, ad)</span>
                <input
                  type="text"
                  placeholder="medium slug"
                  value={customMedium}
                  onChange={(e) => setCustomMedium(e.target.value)}
                  className="w-full text-xs font-mono bg-black/40 border border-[var(--color-border)] rounded-md px-2.5 py-1.5 text-white focus:outline-none focus:border-accent"
                />
              </div>
            </div>
          )}
        </div>

        {/* Step 2: Destination & Campaign Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-mono text-white/60 mb-1.5 uppercase tracking-wider">
              2. Target Landing Page
            </label>
            <select
              value={selectedDest}
              onChange={(e) => setSelectedDest(e.target.value)}
              className="w-full text-xs font-mono bg-black/40 border border-[var(--color-border)] rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-accent cursor-pointer"
            >
              {DESTINATION_PRESETS.map((d) => (
                <option key={d.path} value={d.path} className="bg-neutral-900 text-white">
                  {d.label}
                </option>
              ))}
              <option value="custom" className="bg-neutral-900 text-white">
                Custom Path / Blog Slug...
              </option>
            </select>

            {selectedDest === 'custom' && (
              <input
                type="text"
                placeholder="/blogs/your-article-slug"
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                className="w-full mt-2 text-xs font-mono bg-black/40 border border-[var(--color-border)] rounded-md px-2.5 py-1.5 text-white focus:outline-none focus:border-accent"
              />
            )}
          </div>

          <div>
            <label className="block text-[11px] font-mono text-white/60 mb-1.5 uppercase tracking-wider">
              3. Campaign Tag <span className="text-white/40 lowercase">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. launch-week, bounty-drop"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
              className="w-full text-xs font-mono bg-black/40 border border-[var(--color-border)] rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-accent placeholder:text-white/30"
            />
          </div>
        </div>

        {/* Step 3: Generated URL Preview & Actions */}
        <div className="pt-2">
          <label className="block text-[11px] font-mono text-white/60 mb-1.5 uppercase tracking-wider">
            Ready-to-Share Tracking Link
          </label>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1 min-w-0 bg-black/60 border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs font-mono text-accent truncate selection:bg-accent/30 selection:text-white">
              {generatedUrl}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  'flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono font-medium transition-all cursor-pointer',
                  copied
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : 'bg-accent hover:bg-accent/90 text-white'
                )}
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Link</span>
                  </>
                )}
              </button>

              <a
                href={generatedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center p-2 rounded-lg border border-[var(--color-border)] text-white/70 hover:text-white hover:bg-white/[0.05] transition-colors"
                title="Test link in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
