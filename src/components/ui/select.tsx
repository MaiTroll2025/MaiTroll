import React, { createContext, useContext, useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface SelectContextType {
  value: string
  onValueChange: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
}

const SelectContext = createContext<SelectContextType | null>(null)

export const Select = ({ 
  children, 
  value, 
  onValueChange,
  required: _required = false,
  className = '',
}: { 
  children: React.ReactNode
  value: string
  onValueChange: (value: string) => void 
  required?: boolean
  className?: string
}) => {
  const [open, setOpen] = useState(false)
  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div className={`relative inline-block w-full ${className}`}>{children}</div>
    </SelectContext.Provider>
  )
}

export const SelectTrigger = ({ 
  children, 
  className = "",
  id
}: { 
  children: React.ReactNode
  className?: string
  id?: string
}) => {
  const context = useContext(SelectContext)
  if (!context) throw new Error("SelectTrigger must be used within Select")
  
  return (
    <button
      id={id}
      onClick={() => context.setOpen(!context.open)}
      className={`flex items-center justify-between w-full px-3 py-2 text-sm bg-transparent border rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    >
      {children}
      <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
    </button>
  )
}

export const SelectValue = ({ 
  placeholder 
}: { 
  placeholder?: string 
}) => {
  const context = useContext(SelectContext)
  if (!context) throw new Error("SelectValue must be used within Select")
  
  // This is a simplification; normally you'd map value to label
  return <span>{context.value || placeholder}</span>
}

export const SelectContent = ({ 
  children, 
  className = "",
  sideOffset = 4,
}: { 
  children: React.ReactNode
  className?: string
  position?: 'item-aligned' | 'popper'
  sideOffset?: number
}) => {
  const context = useContext(SelectContext)
  if (!context) throw new Error("SelectContent must be used within Select")
  
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        context.setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [context])

  if (!context.open) return null

  return (
    <div 
      ref={ref}
      className={`absolute z-50 min-w-[8rem] overflow-hidden rounded-md border shadow-md animate-in fade-in-0 zoom-in-95 ${className}`}
      style={{ marginTop: sideOffset }}
    >
      <div className="p-1">{children}</div>
    </div>
  )
}

export const SelectItem = ({ 
  children, 
  value, 
  className = "" 
}: { 
  children: React.ReactNode
  value: string
  className?: string 
}) => {
  const context = useContext(SelectContext)
  if (!context) throw new Error("SelectItem must be used within Select")

  const isSelected = context.value === value

  return (
    <div
      onClick={() => {
        context.onValueChange(value)
        context.setOpen(false)
      }}
      className={`relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-white/10 cursor-pointer ${className}`}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        {isSelected && <Check className="h-4 w-4" />}
      </span>
      {children}
    </div>
  )
}
