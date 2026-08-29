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

import React from 'react'
import { cn } from '@/lib/utils/cn'

interface TechStackItem {
  name: string;
  path: string;
  themedPath: string;
  hoverFilter?: string;
}

const TECH_STACKS: TechStackItem[] = [
  { name: "React", path: "react/react-original", themedPath: "react/react-original" },
  { name: "Next.js", path: "nextjs/nextjs-original", themedPath: "nextjs/nextjs-plain" },
  { name: "HTML5", path: "html5/html5-original", themedPath: "html5/html5-plain" },
  { name: "CSS3", path: "css3/css3-original", themedPath: "css3/css3-plain" },
  { name: "JavaScript", path: "javascript/javascript-original", themedPath: "javascript/javascript-plain" },
  { name: "TypeScript", path: "typescript/typescript-original", themedPath: "typescript/typescript-plain" },
  { name: "Python", path: "python/python-original", themedPath: "python/python-plain" },
  { name: "PHP", path: "php/php-original", themedPath: "php/php-plain" },
  { name: "Go (Golang)", path: "go/go-original", themedPath: "go/go-plain" },
  { name: "Rust", path: "rust/rust-original", themedPath: "rust/rust-original", hoverFilter: "brightness(0) invert(1)" },
  { name: "Nuxt.js", path: "nuxtjs/nuxtjs-original", themedPath: "nuxtjs/nuxtjs-plain" },
  { name: "Vue.js", path: "vuejs/vuejs-original", themedPath: "vuejs/vuejs-plain" },
  { name: "Vite", path: "vitejs/vitejs-original", themedPath: "vitejs/vitejs-plain" },
  { name: "Svelte", path: "svelte/svelte-original", themedPath: "svelte/svelte-plain" },
  { name: "Spring Boot", path: "spring/spring-original", themedPath: "spring/spring-original" },
  { name: "Ruby", path: "ruby/ruby-original", themedPath: "ruby/ruby-plain" },
  { name: "Laravel v2", path: "laravel/laravel-original", themedPath: "laravel/laravel-original" },
  { name: "NestJS", path: "nestjs/nestjs-original", themedPath: "nestjs/nestjs-original" },
  { name: "Lua", path: "lua/lua-original", themedPath: "lua/lua-plain" },
  { name: "Laravel v1", path: "laravel/laravel-original", themedPath: "laravel/laravel-original" },
  { name: "Astro", path: "astro/astro-original", themedPath: "astro/astro-plain", hoverFilter: "brightness(0) invert(1)" },
  { name: "Flask", path: "flask/flask-original", themedPath: "flask/flask-original", hoverFilter: "brightness(0) invert(1)" },
  { name: "C++", path: "cplusplus/cplusplus-original", themedPath: "cplusplus/cplusplus-plain" },
  { name: "C#", path: "csharp/csharp-original", themedPath: "csharp/csharp-plain" },
  { name: "C", path: "c/c-original", themedPath: "c/c-original" },
  { name: "Angular", path: "angular/angular-original", themedPath: "angular/angular-plain" }
];

export default function TechStackTicker({ isHeroEmbedded = false }: { isHeroEmbedded?: boolean }) {
  const displayItems = [...TECH_STACKS, ...TECH_STACKS, ...TECH_STACKS] // Triple for seamless looping
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null)

  return (
    <section className={cn(
      "left-0 w-full h-14 bg-black border-t border-white/10 flex items-center overflow-hidden z-40",
      isHeroEmbedded ? "absolute bottom-0" : "fixed bottom-0"
    )}>
      <div className="absolute left-0 top-0 h-full bg-black z-10 px-8 flex items-center gap-3 border-r border-white/10 select-none hidden sm:flex">
        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
        <span className="text-[11px] tracking-wide text-white/70 whitespace-nowrap font-mono">
          {'//'} supported stacks
        </span>
      </div>

      <div className="flex animate-ticker whitespace-nowrap pl-6 sm:pl-[260px] select-none">
        {displayItems.map((item, index) => {
          const isHovered = hoveredIdx === index
          const imageUrl = `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${item.path}.svg`
          const themedImageUrl = `https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/${item.themedPath}.svg`
          return (
            <div 
              key={index} 
              className="flex items-center gap-3 mx-8 group cursor-default"
              onMouseEnter={() => setHoveredIdx(index)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              <div className="relative w-5 h-5 transition-all duration-300 transform group-hover:scale-110">
                {/* Themed Layer: Monochromatic Outline SVG with orange filter */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={themedImageUrl}
                  alt={item.name}
                  className={cn(
                    "absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-opacity duration-300",
                    isHovered ? "opacity-0" : "opacity-80"
                  )}
                  style={{
                    filter: 'brightness(0) saturate(100%) invert(52%) sepia(85%) saturate(2318%) hue-rotate(357deg) brightness(101%) contrast(106%)'
                  }}
                />
                
                {/* Brand Layer: Original SVG Logo */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={imageUrl}
                  alt={item.name}
                  className={cn(
                    "absolute inset-0 w-full h-full object-contain pointer-events-none select-none transition-opacity duration-300",
                    isHovered ? "opacity-100" : "opacity-0"
                  )}
                  style={item.hoverFilter ? { filter: item.hoverFilter } : undefined}
                />
              </div>
              <span 
                style={{ color: isHovered ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)' }}
                className="text-[13px] font-medium font-mono transition-colors duration-300"
              >
                {item.name}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
