import * as React from 'react'
import { cn } from '@/lib/utils'

export type TableProps = React.TableHTMLAttributes<HTMLTableElement>
export type TableSectionProps = React.HTMLAttributes<HTMLTableSectionElement>
export type TableCellProps = React.ThHTMLAttributes<HTMLTableCellElement>
export type TableCaptionProps = React.HTMLAttributes<HTMLTableCaptionElement>

export const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, ...props }, ref) => (
    <table
      ref={ref}
      className={cn('min-w-full divide-y divide-slate-700 overflow-hidden rounded-xl border border-slate-700 bg-slate-950 text-sm', className)}
      {...props}
    />
  ),
)
Table.displayName = 'Table'

export const TableHeader = React.forwardRef<HTMLTableSectionElement, TableSectionProps>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('bg-slate-900', className)} {...props} />
  ),
)
TableHeader.displayName = 'TableHeader'

export const TableBody = React.forwardRef<HTMLTableSectionElement, TableSectionProps>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('divide-y divide-slate-700', className)} {...props} />
  ),
)
TableBody.displayName = 'TableBody'

export const TableHead = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-400',
        className,
      )}
      {...props}
    />
  ),
)
TableHead.displayName = 'TableHead'

export const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn('border-b border-slate-700/80 transition-colors hover:bg-slate-900/60', className)} {...props} />
  ),
)
TableRow.displayName = 'TableRow'

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, ...props }, ref) => (
    <td
      ref={ref}
      className={cn('px-4 py-3 align-middle text-sm text-slate-200', className)}
      {...props}
    />
  ),
)
TableCell.displayName = 'TableCell'

export const TableCaption = React.forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn('mt-4 text-left text-sm text-slate-400', className)} {...props} />
  ),
)
TableCaption.displayName = 'TableCaption'
