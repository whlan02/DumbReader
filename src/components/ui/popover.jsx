import { cloneElement, createContext, useContext, useMemo, useState } from 'react'

const PopoverCtx = createContext(null)

export function Popover({ children, ...props }) {
  const [open, setOpen] = useState(false)
  const value = useMemo(() => ({ open, setOpen }), [open])
  return (
    <PopoverCtx.Provider value={value}>
      <div {...props}>{children}</div>
    </PopoverCtx.Provider>
  )
}

export function PopoverTrigger({ asChild = false, children }) {
  const { open, setOpen } = useContext(PopoverCtx)
  if (asChild && children) {
    return cloneElement(children, {
      onClick: (e) => {
        children.props?.onClick?.(e)
        setOpen(!open)
      },
    })
  }
  return <button onClick={() => setOpen(!open)}>{children}</button>
}

export function PopoverContent({ className = '', children, ...props }) {
  const { open } = useContext(PopoverCtx)
  if (!open) return null
  return (
    <div className={className} {...props}>
      {children}
    </div>
  )
}
