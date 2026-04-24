function extractDeltaText(delta) {
  if (!delta || typeof delta !== 'object') return ''
  const c = delta.content
  if (typeof c === 'string' && c.length > 0) return c
  if (Array.isArray(c)) {
    return c
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          if (item.type === 'text' && typeof item.text === 'string') return item.text
          if (typeof item.text === 'string') return item.text
        }
        return ''
      })
      .join('')
  }
  return ''
}

export async function* parseOpenRouterSseStream(stream) {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const consumeLine = async function* (line) {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.startsWith('data:')) return
    const data = trimmed.slice(5).trim()
    if (!data || data === '[DONE]') return
    let parsed
    try {
      parsed = JSON.parse(data)
    } catch {
      return
    }
    const possibleError = parsed?.error?.message
    if (possibleError) throw new Error(possibleError)
    const delta = parsed?.choices?.[0]?.delta
    const chunk = extractDeltaText(delta)
    if (chunk.length > 0) yield chunk
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      yield* consumeLine(line)
    }
  }
  if (buffer.trim()) yield* consumeLine(buffer)
}
