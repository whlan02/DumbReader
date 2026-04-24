import {
  OPENROUTER_BASE_URL,
  OPENROUTER_MODEL,
  resolveOpenRouterApiKey,
  toOpenRouterMessages,
} from './knowledgeGraphAssistantOpenRouterConfig'
import { parseOpenRouterSseStream } from './knowledgeGraphAssistantOpenRouterSseStream'

export const openRouterChatAdapter = {
  async *run({ messages, abortSignal }) {
    try {
      const apiKey = resolveOpenRouterApiKey()
      if (!apiKey) {
        throw new Error('OpenRouter API Key not found, please set it in .env or local environment.')
      }
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(typeof window !== 'undefined' && window.location?.origin
            ? { 'HTTP-Referer': window.location.origin }
            : {}),
          'X-Title': 'DumbReader',
        },
        body: JSON.stringify({
          model: OPENROUTER_MODEL,
          messages: toOpenRouterMessages(messages),
          stream: true,
          temperature: 0.6,
        }),
        signal: abortSignal,
      })

      if (!response.ok) {
        const errText = await response.text()
        throw new Error(`OpenRouter request failed: ${response.status} ${response.statusText} ${errText}`)
      }

      if (!response.body) {
        const data = await response.json()
        const text = data?.choices?.[0]?.message?.content || 'The model did not return any text.'
        yield { content: [{ type: 'text', text }] }
        return
      }

      let fullText = ''
      for await (const chunkText of parseOpenRouterSseStream(response.body)) {
        fullText += chunkText
        yield { content: [{ type: 'text', text: fullText }] }
      }
      if (!fullText.trim()) {
        yield { content: [{ type: 'text', text: 'I received your request, but no displayable reply was generated.' }] }
      }
    } catch (error) {
      if (error?.name === 'AbortError') return
      throw error
    }
  },
}
