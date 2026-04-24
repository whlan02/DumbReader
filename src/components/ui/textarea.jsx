import { forwardRef } from 'react'

export const Textarea = forwardRef(function Textarea({ className = '', ...props }, ref) {
  return <textarea ref={ref} className={className} {...props} />
})
