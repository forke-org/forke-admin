import * as React from 'react'
import { cn } from '@/lib/utils/cn'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    const variants = {
      primary: 'ui-btn-primary',
      secondary: 'ui-btn-secondary',
      outline: 'bg-transparent text-accent border border-accent/35 hover:bg-accent/10 hover:border-accent/60',
      ghost: 'text-white hover:bg-white/[0.05]',
    }

    const sizes = {
      sm: 'h-8 px-3 text-[13px] rounded-lg',
      md: 'h-10 px-4 text-[13px] rounded-lg',
      lg: 'h-11 px-5 text-sm rounded-lg',
    }

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-accent/40 disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)

Button.displayName = 'Button'
