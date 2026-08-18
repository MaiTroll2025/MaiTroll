import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

interface MobilePageShellProps {
  children: React.ReactNode
  title?: string
  eyebrow?: string
  subtitle?: string
  showBackButton?: boolean
  rightAction?: React.ReactNode
}

export default function MobilePageShell({
  children,
  title,
  eyebrow,
  subtitle,
  showBackButton,
  rightAction,
}: MobilePageShellProps) {
  const navigate = useNavigate()
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    contentRef.current?.scrollTo(0, 0)
  }, [])

  return (
    <div className="mobile-page-shell">
      {(title || eyebrow || subtitle || showBackButton || rightAction) && (
        <div className="mobile-page-shell__header">
          <div className="mobile-page-shell__header-row">
            <div className="mobile-page-shell__header-left">
              {showBackButton && (
                <button
                  type="button"
                  className="mobile-page-shell__back-btn"
                  aria-label="Back"
                  onClick={() => navigate(-1)}
                >
                  ←
                </button>
              )}
              <div>
                {eyebrow && (
                  <p className="mobile-page-shell__eyebrow">{eyebrow}</p>
                )}
                {title && (
                  <h1 className="mobile-page-shell__title">{title}</h1>
                )}
              </div>
            </div>
            {rightAction && (
              <div className="mobile-page-shell__right-action">
                {rightAction}
              </div>
            )}
          </div>
          {subtitle && (
            <p className="mobile-page-shell__subtitle">{subtitle}</p>
          )}
        </div>
      )}
      <div ref={contentRef} className="mobile-page-shell__content">
        {children}
      </div>
    </div>
  )
}
