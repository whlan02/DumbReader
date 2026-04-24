import { split } from 'sentence-splitter'

function normalizeText(markdown) {
  return String(markdown || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[[^\]]+]\([^)]+\)/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function splitMarkdownToSentences(markdown) {
  const text = normalizeText(markdown)
  if (!text) return []
  try {
    return split(text)
      .filter((n) => n.type === 'Sentence')
      .map((n, index) => ({
        id: `s-${index}`,
        text: n.raw.trim(),
      }))
      .filter((s) => s.text.length > 0)
  } catch {
    return text
      .split(/(?<=[.!?。！？])\s+/)
      .map((v, index) => ({ id: `s-${index}`, text: v.trim() }))
      .filter((s) => s.text.length > 0)
  }
}

export function splitTextToSentences(text, idPrefix = 's') {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!normalized) return []
  try {
    return split(normalized)
      .filter((n) => n.type === 'Sentence')
      .map((n, index) => ({
        id: `${idPrefix}-${index}`,
        text: n.raw.trim(),
      }))
      .filter((s) => s.text.length > 0)
  } catch {
    return normalized
      .split(/(?<=[.!?。！？])\s+/)
      .map((v, index) => ({ id: `${idPrefix}-${index}`, text: v.trim() }))
      .filter((s) => s.text.length > 0)
  }
}

export function getSentenceContext(sentences, sentenceId) {
  const index = sentences.findIndex((s) => s.id === sentenceId)
  if (index < 0) return { prev: '', current: '', next: '' }
  return {
    prev: sentences[index - 1]?.text || '',
    current: sentences[index]?.text || '',
    next: sentences[index + 1]?.text || '',
  }
}

export function tokenizeSentenceWords(sentence) {
  return sentence.split(/(\s+|[,.!?;:()"'[\]{}。！？；：，])/).filter((t) => t.length > 0)
}
