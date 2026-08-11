import React from 'react'

interface MobilePageShellProps {
  children: React.ReactNode
  title?: string
}

export default function MobilePageShell({ children, title }: MobilePageShellProps) {
  return (
    <div className="mobile-page-shell">
      {title && <h1>{title}</h1>}
      {children}
    </div>
  )
}
