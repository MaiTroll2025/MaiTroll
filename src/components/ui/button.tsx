import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link' | 'danger'
  size?: 'default' | 'sm' | 'lg' | 'icon'
  children: React.ReactNode
}

export const Button = ({ variant = 'default', size = 'default', children, ...props }: ButtonProps) => {
  const effectiveVariant = variant === 'danger' ? 'destructive' : variant
  return <button {...props}>{children}</button>
}
