import * as React from "react"
import { cn } from "../../lib/utils"

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label?: React.ReactNode
  onChange?: React.ChangeEventHandler<HTMLInputElement>
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, name, checked, onChange, onCheckedChange, disabled, ...props }, ref) => {
    const generatedId = React.useId()
    const inputId = id ?? `${name ?? "checkbox"}-${generatedId}`

    return (
      <div className="flex items-start gap-3">
        <input
          id={inputId}
          ref={ref}
          type="checkbox"
          name={name}
          checked={checked}
          onChange={(e) => {
            onChange?.(e)
            onCheckedChange?.(e.target.checked)
          }}
          disabled={disabled}
          className={cn(
            "mt-1 h-4 w-4 rounded border border-slate-600 bg-slate-900 text-cyan-500 focus:ring-2 focus:ring-cyan-500/50",
            disabled && "cursor-not-allowed opacity-50",
            className
          )}
          {...props}
        />
        {label ? (
          <label
            htmlFor={inputId}
            className="text-sm text-slate-300 leading-6"
          >
            {label}
          </label>
        ) : null}
      </div>
    )
  }
)

Checkbox.displayName = "Checkbox"

export { Checkbox }
