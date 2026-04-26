const OPENROUTER_BASE_URL = import.meta.env.VITE_OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'
const OPENROUTER_MODEL =
  import.meta.env.VITE_OPENROUTER_MODEL || 'google/gemini-2.5-flash-lite-preview-09-2025'

const IMAGE_TO_MD_SYSTEM_PROMPT =
  `You are an OCR + educational formatting assistant. Convert image content to Markdown and strictly follow:
1) Output Markdown only. No explanation and no prefix/suffix.
2) Keep the original language. Do not translate or rewrite.
3) Mark uncertain characters with [??]. Never guess missing text.
4) Remove irrelevant noise: page numbers, watermarks, camera borders, filenames, and system paths.
5) Output structure:
   - Use # / ## / ### for headings;
   - Split body text into natural paragraphs;
   - Use ordered lists for questions: 1. 2. 3.;
   - Use unordered lists for options: - A. - B. - C. - D.
6) If options are not visible in the image, explicitly write "(Options are not visible in the current image)." Do not fabricate options.
7) Preserve fill-in markers (e.g., *1*, ___) exactly as shown.
8) If there is a table, prefer a Markdown table. If reliable reconstruction is not possible, use bullet points and mark it as "(Approximate table content)".`

const CHAT_SYSTEM_PROMPT =
  '你是 DumbReader 学习助手。请给出简洁、准确、可执行的讲解，优先解释词义、语法与上下文用法。'

const TEXT_TO_MD_SYSTEM_PROMPT = `You are a document-structuring assistant. Reformat messy pasted text into highly readable Markdown.
Requirements:
1) Output Markdown only, no explanation;
2) Keep the original language, no translation;
3) Split into logical paragraphs and use #/## headings;
4) Format questions and options as lists;
5) Do not fabricate information not present in the source; mark uncertain content with [??].`

const MARKDOWN_FILENAME_SYSTEM_PROMPT = `You generate concise file names for markdown notes.
Rules:
1) Return only the file name base text, no extension, no quotes, no explanation.
2) Keep it short and descriptive (3-8 words).
3) Use only letters, numbers, spaces, hyphens, and underscores.
4) Do not include any date/time in your output.
5) If the content is unclear, return: untitled-note`

function resolveApiKey() {
  return import.meta.env.VITE_OPENROUTER_API_KEY || localStorage.getItem('openrouter_api_key') || ''
}

function buildHeaders() {
  const apiKey = resolveApiKey()
  if (!apiKey) {
    throw new Error('OpenRouter API Key is missing. Please set VITE_OPENROUTER_API_KEY in .env.')
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    ...(typeof window !== 'undefined' && window.location?.origin
      ? { 'HTTP-Referer': window.location.origin }
      : {}),
    'X-Title': 'DumbReader',
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export async function imageToMarkdown(file) {
  const imageDataUrl = await fileToDataUrl(file)
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: IMAGE_TO_MD_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Please convert this reading-question image into structured Markdown.' },
            { type: 'image_url', image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Image transcription failed: ${response.status} ${text}`)
  }

  const json = await response.json()
  return json?.choices?.[0]?.message?.content?.trim() || ''
}

export async function textToMarkdown(rawText) {
  const text = String(rawText || '').trim()
  if (!text) return ''
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: TEXT_TO_MD_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `I found an article. Please organize it into Markdown format and improve readability.\n\nOriginal text:\n${text}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Text formatting failed: ${response.status} ${err}`)
  }
  const json = await response.json()
  return json?.choices?.[0]?.message?.content?.trim() || ''
}

export async function suggestFilenameFromMarkdown(markdown) {
  const content = String(markdown || '').trim()
  if (!content) return 'untitled-note'

  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      temperature: 0.1,
      messages: [
        { role: 'system', content: MARKDOWN_FILENAME_SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate a concise filename base for this markdown:\n\n${content.slice(0, 6000)}`,
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Filename generation failed: ${response.status} ${err}`)
  }

  const json = await response.json()
  const rawName = String(json?.choices?.[0]?.message?.content || '').trim()
  return rawName || 'untitled-note'
}

export async function* streamAssistant(messages, abortSignal) {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      stream: true,
      temperature: 0.5,
      messages: [{ role: 'system', content: CHAT_SYSTEM_PROMPT }, ...messages],
    }),
    signal: abortSignal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Assistant request failed: ${response.status} ${text}`)
  }
  if (!response.body) return

  const decoder = new TextDecoder()
  const reader = response.body.getReader()
  let buffer = ''
  let fullText = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const t = line.trim()
      if (!t.startsWith('data:')) continue
      const payload = t.slice(5).trim()
      if (payload === '[DONE]') continue
      try {
        const parsed = JSON.parse(payload)
        const delta = parsed?.choices?.[0]?.delta?.content
        if (typeof delta === 'string') {
          fullText += delta
          yield fullText
        }
      } catch {
        // ignore invalid sse chunk
      }
    }
  }

  if (!fullText.trim()) {
    yield 'I received your request, but no displayable reply was generated.'
  }
}
