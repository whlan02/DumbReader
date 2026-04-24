import { useEffect, useRef, useState } from 'react'
import { Send, Square } from 'lucide-react'
import { Textarea } from '../ui/textarea'
import { Button } from '../ui/button'
import { useKnowledgeGraphAssistantChat } from './KnowledgeGraphAssistantChatContext'

export default function ChatComposer({
  variant = 'main',
  placeholder = 'Ask me anything...',
  rows = 1,
  autoFocus = false,
  cancelOnEscape = false,
  enableOutsideCancel = false,
  editInitialText = '',
}) {
  const { sendFromMain, cancelRun, isRunning, submitUserEdit, cancelEditUser, editingUserMessageId, mainInputDraft } =
    useKnowledgeGraphAssistantChat()
  const isEdit = variant === 'edit'
  const [text, setText] = useState(() => (isEdit ? editInitialText : mainInputDraft || ''))
  const rootRef = useRef(null)
  const textareaRef = useRef(null)

  const adjustTextareaHeight = () => {
    const el = textareaRef.current
    if (!el) return
    const maxHeight = isEdit ? 140 : 200
    el.style.height = 'auto'
    const next = Math.min(el.scrollHeight, maxHeight)
    el.style.height = `${Math.max(next, 40)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }

  useEffect(() => {
    if (isEdit) setText(editInitialText)
  }, [isEdit, editInitialText, editingUserMessageId])

  useEffect(() => {
    if (!isEdit) setText(mainInputDraft || '')
  }, [isEdit, mainInputDraft])

  useEffect(() => {
    adjustTextareaHeight()
  }, [text, isEdit])

  useEffect(() => {
    if (!enableOutsideCancel || !isEdit) return undefined
    const onPointerDown = (event) => {
      const root = rootRef.current
      if (!root) return
      if (root.contains(event.target)) return
      cancelEditUser()
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [enableOutsideCancel, isEdit, cancelEditUser])

  const onSend = async () => {
    const t = text.trim()
    if (!t) return
    if (isEdit) {
      if (!editingUserMessageId) return
      await submitUserEdit(t)
      setText('')
    } else {
      await sendFromMain(t)
      setText('')
    }
  }

  return (
    <div ref={rootRef} className={`kg-chat-composer-wrap ${isEdit ? 'kg-chat-composer-wrap--edit' : ''}`}>
      <div className={`kg-chat-composer ${isEdit ? 'kg-chat-composer--edit' : ''}`}>
        <Textarea
          ref={textareaRef}
          placeholder={placeholder}
          className={`kg-chat-input min-h-0 border-0 bg-transparent shadow-none focus-visible:ring-0 ${
            isEdit ? 'kg-chat-input--edit' : ''
          }`}
          rows={rows}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
          }}
          autoFocus={autoFocus}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              onSend()
            } else if (e.key === 'Escape') {
              if (isEdit) {
                e.preventDefault()
                cancelEditUser()
                setText(editInitialText)
              } else if (cancelOnEscape) {
                e.preventDefault()
                setText('')
              }
            }
          }}
        />
        <div className="kg-chat-composer-actions">
          <div className="kg-chat-composer-right-actions">
            {isEdit ? (
              <Button
                type="button"
                variant="default"
                size="icon"
                onClick={onSend}
                className="kg-chat-send-btn kg-chat-send-btn--edit"
                title="Save and resend"
                aria-label="Save and resend"
              >
                <Send size={16} />
              </Button>
            ) : !isRunning ? (
              <Button
                type="button"
                variant="default"
                size="icon"
                onClick={onSend}
                className="kg-chat-send-btn"
                title="Send"
                disabled={!text.trim()}
                aria-label="Send"
              >
                <Send size={16} />
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                onClick={cancelRun}
                className="kg-chat-cancel-btn"
                title="Stop generation"
                aria-label="Stop generation"
              >
                <Square size={15} fill="currentColor" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
