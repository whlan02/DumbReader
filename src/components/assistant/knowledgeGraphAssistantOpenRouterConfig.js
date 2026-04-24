export const OPENROUTER_BASE_URL =
  import.meta.env.VITE_OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'

export const OPENROUTER_MODEL =
  import.meta.env.VITE_OPENROUTER_MODEL ||
  import.meta.env.VITE_OPENAI_MODEL ||
  'google/gemini-2.5-flash-lite-preview-09-2025'

const CHAT_SYSTEM_PROMPT =
  'You are DumbReader assistant. Give practical, concise, and accurate answers for language learning workflows.'

export const resolveOpenRouterApiKey = () => {
  const envKey = import.meta.env.VITE_OPENROUTER_API_KEY || import.meta.env.VITE_OPENAI_API_KEY
  if (envKey && !String(envKey).includes('your_key_here')) return envKey
  if (typeof window === 'undefined') return ''
  return localStorage.getItem('openrouter_api_key') || localStorage.getItem('openai_api_key') || ''
}

export const toOpenRouterMessages = (messages) => {
  const normalized = messages
    .filter((message) => ['user', 'assistant', 'system'].includes(message.role))
    .map((message) => {
      const content = (message.content || [])
        .filter((part) => part.type === 'text' && typeof part.text === 'string')
        .map((part) => part.text)
        .join('\n')
        .trim()

      return {
        role: message.role,
        content,
      }
    })
    .filter((message) => message.content.length > 0)

  return [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...normalized]
}
