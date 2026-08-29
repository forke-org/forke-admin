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
import { Laptop, IndianRupee, Users, School } from 'lucide-react'

const STATS = [
  { label: 'Tasks Completed', value: '1,240+', icon: <Laptop className="w-8 h-8 text-accent" /> },
  { label: 'Total Paid Out', value: '₹4.8L+', icon: <IndianRupee className="w-8 h-8 text-accent" /> },
  { label: 'Active Developers', value: '850+', icon: <Users className="w-8 h-8 text-accent" /> },
  { label: 'Colleges Reached', value: '12+', icon: <School className="w-8 h-8 text-accent" /> },
 ]

export default function Stats() {
  return (
    <section className="py-20 md:py-24 bg-bg border-y border-border">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
          {STATS.map((stat, index) => (
            <div key={index} className="flex flex-col items-center md:items-start space-y-4 group">
              <div className="p-3 rounded-2xl bg-accent/5 border border-accent/10 group-hover:bg-accent/10 transition-colors">
                {stat.icon}
              </div>
              <div className="space-y-1">
                <span className="block font-serif text-5xl md:text-6xl text-white tracking-tighter">
                  {stat.value}
                </span>
                <span className="block text-accent text-[10px] font-bold uppercase tracking-[0.3em]">
                  {stat.label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
