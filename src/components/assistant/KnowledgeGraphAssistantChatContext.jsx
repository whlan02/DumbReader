import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { openRouterChatAdapter } from './knowledgeGraphAssistantOpenRouterChatAdapter'

function toWireMessage(m) {
  return { role: m.role, content: [{ type: 'text', text: m.text ?? '' }] }
}

const KnowledgeGraphAssistantChatContext = createContext(null)

export function KnowledgeGraphAssistantChatProvider({ children }) {
  const [messages, setMessages] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [editingUserMessageId, setEditingUserMessageId] = useState(null)
  const [mainInputDraft, setMainInputDraft] = useState('')
  const abortRef = useRef(null)
  const runEpochRef = useRef(0)

  const cancelRun = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const runAssistantAfter = useCallback(async (threadForApi) => {
    const epoch = runEpochRef.current
    const assistantId = crypto.randomUUID()
    setMessages((prev) =>
      runEpochRef.current === epoch
        ? [...prev, { id: assistantId, role: 'assistant', text: '', streaming: true, error: undefined }]
        : prev,
    )
    if (runEpochRef.current !== epoch) return
    setIsRunning(true)
    const ac = new AbortController()
    abortRef.current = ac
    const apply = (updater) => {
      if (runEpochRef.current !== epoch) return
      setMessages(updater)
    }
    try {
      const wire = threadForApi.map(toWireMessage)
      const gen = openRouterChatAdapter.run({ messages: wire, abortSignal: ac.signal })
      for await (const update of gen) {
        if (runEpochRef.current !== epoch) return
        const t = update?.content?.[0]?.text ?? ''
        apply((prev) => prev.map((m) => (m.id === assistantId ? { ...m, text: t, error: undefined } : m)))
      }
    } catch (err) {
      if (err?.name === 'AbortError') {
        apply((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)))
        return
      }
      const msg = err instanceof Error ? err.message : String(err)
      apply((prev) => prev.map((m) => (m.id === assistantId ? { ...m, error: msg, streaming: false } : m)))
    } finally {
      if (runEpochRef.current === epoch) {
        apply((prev) => prev.map((m) => (m.id === assistantId ? { ...m, streaming: false } : m)))
        setIsRunning(false)
        abortRef.current = null
      }
    }
  }, [])

  const sendFromMain = useCallback(
    async (rawText) => {
      const text = String(rawText || '').trim()
      if (!text || isRunning) return
      const userId = crypto.randomUUID()
      const userMsg = { id: userId, role: 'user', text }
      const threadForApi = [...messages, userMsg]
      setMessages((prev) => [...prev, userMsg])
      setMainInputDraft('')
      await runAssistantAfter(threadForApi)
    },
    [isRunning, messages, runAssistantAfter],
  )

  const newSession = useCallback(() => {
    if (isRunning) cancelRun()
    runEpochRef.current += 1
    setMessages([])
    setEditingUserMessageId(null)
    setIsRunning(false)
    setMainInputDraft('')
    abortRef.current = null
  }, [cancelRun, isRunning])

  const startEditUser = useCallback((id) => {
    setEditingUserMessageId(id)
  }, [])
  const cancelEditUser = useCallback(() => {
    setEditingUserMessageId(null)
  }, [])

  const submitUserEdit = useCallback(
    async (rawText) => {
      const text = String(rawText || '').trim()
      const id = editingUserMessageId
      if (!id || !text || isRunning) return
      const idx = messages.findIndex((m) => m.id === id)
      if (idx < 0 || messages[idx].role !== 'user') return
      const base = messages.slice(0, idx)
      const updatedUser = { ...messages[idx], text }
      const threadForApi = [...base, updatedUser]
      setMessages([...base, updatedUser])
      setEditingUserMessageId(null)
      await runAssistantAfter(threadForApi)
    },
    [editingUserMessageId, isRunning, messages, runAssistantAfter],
  )

  const reloadAssistant = useCallback(
    async (assistantMessageId) => {
      if (isRunning) return
      const idx = messages.findIndex((m) => m.id === assistantMessageId)
      if (idx < 0 || messages[idx].role !== 'assistant') return
      const threadForApi = messages.slice(0, idx)
      if (threadForApi.length === 0) return
      setMessages(threadForApi)
      await runAssistantAfter(threadForApi)
    },
    [isRunning, messages, runAssistantAfter],
  )

  const copyText = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text || '')
    } catch {}
  }, [])

  useEffect(() => {
    const handler = (event) => {
      const prompt = event?.detail?.prompt
      const append = Boolean(event?.detail?.append)
      if (typeof prompt !== 'string') return
      if (!append) {
        setMainInputDraft(prompt)
        return
      }
      setMainInputDraft((prev) => {
        const left = String(prev || '').trim()
        const right = prompt.trim()
        if (!left) return right
        if (!right) return left
        return `${left}\n${right}`
      })
    }
    window.addEventListener('dumbreader-assistant-prefill', handler)
    return () => window.removeEventListener('dumbreader-assistant-prefill', handler)
  }, [])

  useEffect(() => {
    const handler = (event) => {
      const prompt = event?.detail?.prompt
      if (typeof prompt !== 'string') return
      void sendFromMain(prompt)
    }
    window.addEventListener('dumbreader-assistant-send', handler)
    return () => window.removeEventListener('dumbreader-assistant-send', handler)
  }, [sendFromMain])

  const value = useMemo(
    () => ({
      messages,
      isRunning,
      editingUserMessageId,
      mainInputDraft,
      setMainInputDraft,
      sendFromMain,
      cancelRun,
      newSession,
      startEditUser,
      cancelEditUser,
      submitUserEdit,
      reloadAssistant,
      copyText,
    }),
    [
      messages,
      isRunning,
      editingUserMessageId,
      mainInputDraft,
      sendFromMain,
      cancelRun,
      newSession,
      startEditUser,
      cancelEditUser,
      submitUserEdit,
      reloadAssistant,
      copyText,
    ],
  )

  return <KnowledgeGraphAssistantChatContext.Provider value={value}>{children}</KnowledgeGraphAssistantChatContext.Provider>
}

export function useKnowledgeGraphAssistantChat() {
  const v = useContext(KnowledgeGraphAssistantChatContext)
  if (!v) throw new Error('useKnowledgeGraphAssistantChat must be used within KnowledgeGraphAssistantChatProvider')
  return v
}
