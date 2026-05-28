import React from 'react'
import { Mail } from 'lucide-react'

export default function Footer() {
  return (
    <footer className="py-24 border-t border-border bg-bg px-4">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-12 lg:gap-16">
        {/* Brand */}
        <div className="space-y-6">
          <div className="flex items-center">
            <img 
              src="/forke-assets/forke_logo.png" 
              alt="Forke Logo" 
              className="w-23 h-23 object-contain"
            />
            <div className="font-serif text-5xl text-white">
              Forke
            </div>
          </div>
          <p className="text-muted text-sm font-light leading-relaxed max-w-xs">
            Built for India&apos;s developers. <br />
            The micro-task marketplace to ship real work and get paid instantly.
          </p>
        </div>

        {/* Navigation */}
        <div>
          <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-6">Navigate</h4>
          <ul className="space-y-4 columns-2 gap-x-12">
            <li><a href="/whats-forke" className="text-muted hover:text-white transition-colors text-sm font-light">What&apos;s Forke?</a></li>
            <li><a href="/tasks" className="text-muted hover:text-white transition-colors text-sm font-light">Bounties</a></li>
            <li><a href="/levels" className="text-muted hover:text-white transition-colors text-sm font-light">Levels</a></li>
            <li><a href="/levels" className="text-muted hover:text-white transition-colors text-sm font-light">Leaderboards</a></li>
            <li><a href="/whats-forke" className="text-muted hover:text-white transition-colors text-sm font-light">Blog</a></li>
          </ul>
        </div>

        {/* Connect */}
        <div>
          <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-6">Connect</h4>
          <div className="flex items-center gap-4 flex-wrap">
            {/* LinkedIn */}
            <a 
              href="https://www.linkedin.com/company/forke/?viewAsMember=true" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-muted hover:text-accent transition-colors p-2.5 bg-white/5 rounded-xl border border-white/10 hover:border-accent/30 flex items-center justify-center"
              aria-label="LinkedIn"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
            </a>
            {/* GitHub */}
            <a 
              href="https://github.com/forke-org" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-muted hover:text-accent transition-colors p-2.5 bg-white/5 rounded-xl border border-white/10 hover:border-accent/30 flex items-center justify-center"
              aria-label="GitHub"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
            {/* Email */}
            <a 
              href="mailto:support@forke.space" 
              className="text-muted hover:text-accent transition-colors p-2.5 bg-white/5 rounded-xl border border-white/10 hover:border-accent/30 flex items-center justify-center"
              aria-label="Email support"
            >
              <Mail className="w-5 h-5" />
            </a>
          </div>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto pt-12 mt-12 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
        <p className="text-muted text-xs uppercase tracking-widest font-bold">© 2026 Forke. All rights reserved.</p>
        <div className="flex gap-6 text-muted text-xs font-light">
          <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
        </div>
        <p className="text-muted text-xs font-light">Made with <span className="text-red-500">❤️</span> and late nights.</p>
      </div>
    </footer>
  )
}
