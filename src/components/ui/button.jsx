import { cloneElement, forwardRef, isValidElement } from 'react'

export const Button = forwardRef(function Button(
  { className = '', variant = 'default', size = 'default', asChild = false, children, ...props },
  ref,
) {
  if (asChild && isValidElement(children)) {
    const child = children
    const mergedClassName = [child.props?.className || '', className].join(' ').trim()
    return cloneElement(child, { ...props, className: mergedClassName, ref })
  }

  const variantClass =
    variant === 'outline'
      ? 'btn-outline'
      : variant === 'secondary'
        ? 'btn-secondary'
        : variant === 'ghost'
          ? 'btn-ghost'
          : 'btn-default'
  const sizeClass =
    size === 'icon' || size === 'icon-xs' || size === 'icon-sm' || size === 'icon-lg'
      ? 'btn-icon'
      : 'btn-normal'
  return (
    <button ref={ref} className={`sr-btn ${variantClass} ${sizeClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
})
