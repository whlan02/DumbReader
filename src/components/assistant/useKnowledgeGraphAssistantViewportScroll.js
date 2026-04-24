import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useKnowledgeGraphAssistantChat } from './KnowledgeGraphAssistantChatContext'

const SCROLL_END_THRESHOLD_PX = 40

export function useKnowledgeGraphAssistantViewportScroll() {
  const { messages, isRunning } = useKnowledgeGraphAssistantChat()
  const viewportRef = useRef(null)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const messageCount = messages.length

  const scrollViewportToBottom = useCallback((behavior = 'instant') => {
    const el = viewportRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior })
  }, [])

  useLayoutEffect(() => {
    scrollViewportToBottom('instant')
  }, [messageCount, scrollViewportToBottom])

  useEffect(() => {
    if (!isRunning) return
    const t = setInterval(() => {
      scrollViewportToBottom('instant')
    }, 100)
    return () => clearInterval(t)
  }, [isRunning, scrollViewportToBottom])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return undefined
    const update = () => {
      const gap = el.scrollHeight - el.scrollTop - el.clientHeight
      const atBottom = gap <= SCROLL_END_THRESHOLD_PX || el.scrollHeight <= el.clientHeight
      setShowScrollToBottom(!atBottom)
    }
    el.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    update()
    return () => {
      el.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [messageCount])

  return { viewportRef, showScrollToBottom, scrollViewportToBottom }
}
