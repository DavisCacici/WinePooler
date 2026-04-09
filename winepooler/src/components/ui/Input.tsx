import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

type InputSize = 'sm' | 'md' | 'lg'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  inputSize?: InputSize
}

const sizeClasses: Record<InputSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-4 py-3 text-base',
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, inputSize = 'md', id, className = '', ...rest }, ref) => {
    const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

    return (
      <div>
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium text-secondary mb-1">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`block w-full rounded-xl border bg-surface text-primary focus:outline-none focus:ring-2 focus:ring-focus ${
            error ? 'border-error bg-error-bg' : 'border-border'
          } ${sizeClasses[inputSize]} ${className}`}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && inputId ? `${inputId}-error` : undefined}
          {...rest}
        />
        {error && (
          <p id={inputId ? `${inputId}-error` : undefined} role="alert" className="mt-1 text-sm text-error">
            {error}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
