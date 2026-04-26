import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import { ChevronDown, Clipboard, LoaderCircle, Trash2, Upload } from 'lucide-react'
import KnowledgeGraphAssistantChat from './components/assistant/KnowledgeGraphAssistantChat'
import { imageToMarkdown, suggestFilenameFromMarkdown, textToMarkdown } from './lib/openrouter'
import { splitTextToSentences, tokenizeSentenceWords } from './lib/sentences'
import './App.css'

const SAMPLE_MD = `# Reading Passage

Tom moved to a new city last month. He found the mornings difficult because he had to wake up earlier than before.
However, after two weeks, he started to enjoy walking to school and talking with new classmates.

## Questions
1. Why were Tom's mornings difficult at first?
2. What changed after two weeks?
`

function runtimeApiUrl(pathname) {
  if (typeof window === 'undefined') return pathname
  return new URL(pathname, window.location.origin).toString()
}

async function saveMarkdownToLocalFile(content, preferredBaseName = '') {
  const response = await fetch(runtimeApiUrl('/api/save-markdown'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, preferredBaseName }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Save failed: ${text}`)
  }
  return response.json()
}

async function listSavedMarkdownFiles() {
  const response = await fetch(runtimeApiUrl('/api/saved-markdown/list'))
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to read directory: ${text}`)
  }
  const json = await response.json()
  return Array.isArray(json?.files) ? json.files : []
}

async function loadSavedMarkdownFile(name) {
  const response = await fetch(runtimeApiUrl(`/api/saved-markdown/file?name=${encodeURIComponent(name)}`))
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Failed to read file: ${text}`)
  }
  const json = await response.json()
  return String(json?.content || '')
}

async function deleteSavedMarkdownFile(name) {
  const response = await fetch(runtimeApiUrl('/api/saved-markdown/delete'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Delete failed: ${text}`)
  }
  return response.json()
}

function keyOfWord(sentenceId, word) {
  return `${sentenceId}::${word.toLowerCase()}`
}

function extractTextFromChildren(children) {
  if (children == null) return ''
  if (typeof children === 'string' || typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map((c) => extractTextFromChildren(c)).join('')
  if (typeof children === 'object' && children.props) return extractTextFromChildren(children.props.children)
  return ''
}

function stableTextId(text, prefix) {
  const source = String(text || '')
  let hash = 0
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0
  }
  return `${prefix}-${hash.toString(16)}`
}

function isImageFile(file) {
  return Boolean(file && typeof file.type === 'string' && file.type.startsWith('image/'))
}

function pickImageFiles(fileLikeList) {
  return Array.from(fileLikeList || []).filter((file) => isImageFile(file))
}

function extractImagesFromClipboard(clipboardData) {
  const itemImages = Array.from(clipboardData?.items || [])
    .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
    .map((item) => item.getAsFile())
    .filter(Boolean)
  const fileImages = pickImageFiles(clipboardData?.files)
  return itemImages.length > 0 ? itemImages : fileImages
}

function createPendingImageItem(file) {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    file,
    previewUrl: URL.createObjectURL(file),
  }
}

function dataTransferHasImage(dataTransfer) {
  if (!dataTransfer) return false
  const itemList = Array.from(dataTransfer.items || [])
  if (itemList.some((item) => item.kind === 'file' && item.type.startsWith('image/'))) return true
  return pickImageFiles(dataTransfer.files).length > 0
}

function InteractiveTextBlock({
  as: Tag = 'p',
  children,
  onWordCtrlClick,
  onSentenceContextMenu,
  selectedSet,
  blockId,
  copiedTokenKey = '',
  onCopyWord,
}) {
  const rawText = extractTextFromChildren(children)
  const sentences = splitTextToSentences(rawText, blockId)
  if (!sentences.length) return <Tag>{children}</Tag>

  return (
    <Tag>
      {sentences.map((sentence) => (
        <span
          key={sentence.id}
          className="sentence md-sentence"
          data-sentence-id={sentence.id}
          onContextMenu={(e) => onSentenceContextMenu(e, sentence.id, sentence.text)}
        >
          {(() => {
            let wordIndex = -1
            return tokenizeSentenceWords(sentence.text).map((token, idx) => {
            const clean = token.trim()
            const punctuation = /^[\s,.!?;:()"'[\]{}。！？；：，]+$/.test(token)
            const sequenceIndex = punctuation ? -1 : (wordIndex += 1)
            const selectedNow = clean ? selectedSet.has(keyOfWord(sentence.id, clean)) : false
            const tokenKey = `${sentence.id}::${idx}::${token}`
            const copiedNow = copiedTokenKey && copiedTokenKey === tokenKey
            return (
              <span
                key={`${sentence.id}-${idx}-${token}`}
                className={`${selectedNow ? 'word word-selected' : 'word'} ${copiedNow ? 'word-copied' : ''}`.trim()}
                onClick={(e) => {
                  if (!clean || punctuation) return
                  if (!e.ctrlKey && !e.metaKey) {
                    onCopyWord?.(tokenKey, clean)
                    return
                  }
                  e.preventDefault()
                  onWordCtrlClick(sentence.id, clean, sequenceIndex, e.currentTarget.closest('.md-sentence'))
                }}
                role="button"
                tabIndex={0}
              >
                {punctuation ? token : `${token} `}
                {copiedNow ? <span className="copy-badge">Copied</span> : null}
              </span>
            )
            })
          })()}
        </span>
      ))}
    </Tag>
  )
}

function App() {
  const [markdown, setMarkdown] = useState(SAMPLE_MD)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [selected, setSelected] = useState([])
  const [savedFiles, setSavedFiles] = useState([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [activeSavedFile, setActiveSavedFile] = useState('')
  const [savedPanelOpen, setSavedPanelOpen] = useState(false)
  const [textImportOpen, setTextImportOpen] = useState(false)
  const [textImportValue, setTextImportValue] = useState('')
  const [textImportLoading, setTextImportLoading] = useState(false)
  const [imageUploadOpen, setImageUploadOpen] = useState(false)
  const [pendingImages, setPendingImages] = useState([])
  const [previewImage, setPreviewImage] = useState(null)
  const [context, setContext] = useState({ prev: '', current: '', next: '' })
  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, sentenceId: '', sentenceText: '' })
  const [copiedTokenKey, setCopiedTokenKey] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const previewRef = useRef(null)
  const imageInputRef = useRef(null)
  const copiedTimerRef = useRef(null)
  const dragDepthRef = useRef(0)
  const pendingImagesRef = useRef([])

  const selectedWordsText = useMemo(() => {
    if (!selected.length) return ''
    if (selected.length === 1) return selected[0].word

    const sameSentence = selected.every((item) => item.sentenceId === selected[0].sentenceId)
    const hasAllIndexes = selected.every((item) => Number.isInteger(item.tokenIndex))
    if (!sameSentence || !hasAllIndexes) {
      return selected.map((s) => s.word).join(', ')
    }

    const ordered = [...selected].sort((a, b) => a.tokenIndex - b.tokenIndex)
    const firstIndex = ordered[0].tokenIndex
    const lastIndex = ordered[ordered.length - 1].tokenIndex
    const isContinuous = lastIndex - firstIndex + 1 === ordered.length

    return isContinuous ? ordered.map((s) => s.word).join(' ') : selected.map((s) => s.word).join(', ')
  }, [selected])
  const selectedSet = useMemo(() => new Set(selected.map((s) => s.key)), [selected])

  const contextPrompt = useMemo(() => {
    if (!selected.length) return ''
    return `上下文：
前句：${context.prev || '(无)'}
当前句：${context.current || '(无)'}
后句：${context.next || '(无)'}
选中的单词：${selectedWordsText}
请解释这些单词在上述上下文中的含义、语法成分及用法，尽量简洁清晰`
  }, [context.current, context.next, context.prev, selected.length, selectedWordsText])

  const refreshSavedFiles = async () => {
    setSavedLoading(true)
    try {
      const files = await listSavedMarkdownFiles()
      setSavedFiles(files)
      if (files.length > 0 && !activeSavedFile) setActiveSavedFile(files[0])
    } catch (error) {
      console.error(error)
    } finally {
      setSavedLoading(false)
    }
  }

  const processImageFiles = async (fileLikeList) => {
    const files = pickImageFiles(fileLikeList)
    if (files.length === 0 || ocrLoading) return
    setOcrLoading(true)
    try {
      const chunks = []
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i]
        const md = await imageToMarkdown(file)
        chunks.push(md || 'No usable content recognized.')
      }
      const mergedMarkdown = chunks.join('\n\n---\n\n') || '# OCR Result\n\nNo usable content recognized.'
      setMarkdown(mergedMarkdown)
      const suggestedName = await suggestFilenameFromMarkdown(mergedMarkdown)
      const saved = await saveMarkdownToLocalFile(mergedMarkdown, suggestedName)
      if (saved?.fileName) setActiveSavedFile(saved.fileName)
      await refreshSavedFiles()
      setSelected([])
      setContext({ prev: '', current: '', next: '' })
      setContextMenu({ open: false, x: 0, y: 0, sentenceId: '', sentenceText: '' })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      alert(msg)
    } finally {
      setOcrLoading(false)
    }
  }

  const addPendingImages = (fileLikeList) => {
    const files = pickImageFiles(fileLikeList)
    if (files.length === 0) return
    setPendingImages((prev) => [
      ...prev,
      ...files.map((file) => createPendingImageItem(file)),
    ])
  }

  const onUploadImage = (event) => {
    addPendingImages(event.target.files)
    event.target.value = ''
  }

  const onProcessPendingImages = async () => {
    if (pendingImages.length === 0 || ocrLoading) return
    await processImageFiles(pendingImages.map((item) => item.file))
    pendingImages.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    setPendingImages([])
    setImageUploadOpen(false)
  }

  const removePendingImage = (id) => {
    setPendingImages((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((item) => item.id !== id)
    })
  }

  const clearPendingImages = () => {
    setPendingImages((prev) => {
      prev.forEach((item) => URL.revokeObjectURL(item.previewUrl))
      return []
    })
  }

  const injectPromptToAssistant = () => {
    if (!contextPrompt) return
    window.dispatchEvent(
      new CustomEvent('dumbreader-assistant-prefill', {
        detail: { prompt: contextPrompt },
      }),
    )
    clearSelectedContext()
  }

  const clearSelectedContext = () => {
    setSelected([])
    setContext({ prev: '', current: '', next: '' })
  }

  const onImportTextToMarkdown = async () => {
    const raw = textImportValue.trim()
    if (!raw || textImportLoading) return
    setTextImportLoading(true)
    try {
      const md = await textToMarkdown(raw)
      const mergedMarkdown = md || '# Text Import\n\nNo usable Markdown was generated.'
      setMarkdown(mergedMarkdown)
      const suggestedName = await suggestFilenameFromMarkdown(mergedMarkdown)
      const saved = await saveMarkdownToLocalFile(mergedMarkdown, suggestedName)
      if (saved?.fileName) setActiveSavedFile(saved.fileName)
      await refreshSavedFiles()
      setSelected([])
      setContext({ prev: '', current: '', next: '' })
      setContextMenu({ open: false, x: 0, y: 0, sentenceId: '', sentenceText: '' })
      setTextImportOpen(false)
      setTextImportValue('')
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error))
    } finally {
      setTextImportLoading(false)
    }
  }

  const onOpenSavedFile = async (name) => {
    try {
      const content = await loadSavedMarkdownFile(name)
      if (!content.trim()) return
      setMarkdown(content)
      setActiveSavedFile(name)
      setSelected([])
      setContext({ prev: '', current: '', next: '' })
      setContextMenu({ open: false, x: 0, y: 0, sentenceId: '', sentenceText: '' })
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error))
    }
  }

  const onDeleteSavedFile = async (name) => {
    try {
      await deleteSavedMarkdownFile(name)
      const next = savedFiles.filter((f) => f !== name)
      setSavedFiles(next)
      if (activeSavedFile === name) {
        const fallback = next[0] || ''
        setActiveSavedFile(fallback)
        if (fallback) {
          const content = await loadSavedMarkdownFile(fallback)
          setMarkdown(content || SAMPLE_MD)
        } else {
          setMarkdown(SAMPLE_MD)
        }
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error))
    }
  }

  const closeContextMenu = () => {
    setContextMenu({ open: false, x: 0, y: 0, sentenceId: '', sentenceText: '' })
  }

  const showCopiedFeedback = (tokenKey) => {
    setCopiedTokenKey(tokenKey)
    if (copiedTimerRef.current) {
      window.clearTimeout(copiedTimerRef.current)
    }
    copiedTimerRef.current = window.setTimeout(() => {
      setCopiedTokenKey('')
      copiedTimerRef.current = null
    }, 900)
  }

  const onWordCtrlClick = (sentenceId, word, tokenIndex, sentenceEl) => {
    const normalized = String(word || '').trim()
    if (!normalized || /^[\s,.!?;:()"'[\]{}。！？；：，]+$/.test(normalized)) return

    const k = keyOfWord(sentenceId, normalized)
    setSelected((prev) => {
      const exists = prev.some((p) => p.key === k)
      if (exists) return prev.filter((p) => p.key !== k)
      return [...prev, { key: k, sentenceId, word: normalized, tokenIndex }]
    })

    if (!sentenceEl || !previewRef.current) return
    const allSentences = Array.from(previewRef.current.querySelectorAll('.md-sentence'))
    const currentIndex = allSentences.indexOf(sentenceEl)
    if (currentIndex < 0) return
    setContext({
      prev: allSentences[currentIndex - 1]?.textContent?.trim() || '',
      current: allSentences[currentIndex]?.textContent?.trim() || '',
      next: allSentences[currentIndex + 1]?.textContent?.trim() || '',
    })
  }

  const onSentenceContextMenu = (event, sentenceId, sentenceText) => {
    event.preventDefault()
    setContextMenu({
      open: true,
      x: event.clientX,
      y: event.clientY,
      sentenceId,
      sentenceText: sentenceText || '',
    })
  }

  const addSentenceToAssistantContext = () => {
    if (!contextMenu.sentenceText.trim()) return
    window.dispatchEvent(
      new CustomEvent('dumbreader-assistant-prefill', {
        detail: {
          prompt: contextMenu.sentenceText.trim(),
          append: true,
        },
      }),
    )
    closeContextMenu()
  }

  const askSentenceMeaning = () => {
    const sentence = contextMenu.sentenceText.trim()
    if (!sentence) return
    window.dispatchEvent(
      new CustomEvent('dumbreader-assistant-send', {
        detail: {
          prompt: `${sentence}\n\n这句话是什么意思？`,
        },
      }),
    )
    closeContextMenu()
  }

  useEffect(() => {
    void refreshSavedFiles()
  }, [])

  useEffect(() => {
    if (!contextMenu.open) return undefined
    const onPointerDown = () => closeContextMenu()
    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeContextMenu()
    }
    window.addEventListener('mousedown', onPointerDown)
    window.addEventListener('scroll', onPointerDown, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('scroll', onPointerDown, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [contextMenu.open])

  useEffect(() => {
    pendingImagesRef.current = pendingImages
  }, [pendingImages])

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
      pendingImagesRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl))
    }
  }, [])

  useEffect(() => {
    const onPaste = (event) => {
      if (ocrLoading || !imageUploadOpen) return
      const images = extractImagesFromClipboard(event.clipboardData)
      if (images.length === 0) return
      event.preventDefault()
      addPendingImages(images)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [imageUploadOpen, ocrLoading])

  useEffect(() => {
    if (!previewImage) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setPreviewImage(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [previewImage])

  const onPageDragEnter = (event) => {
    if (!dataTransferHasImage(event.dataTransfer) || ocrLoading) return
    event.preventDefault()
    dragDepthRef.current += 1
    setDragActive(true)
  }

  const onPageDragOver = (event) => {
    if (!dataTransferHasImage(event.dataTransfer) || ocrLoading) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    if (!dragActive) setDragActive(true)
  }

  const onPageDragLeave = (event) => {
    if (!dataTransferHasImage(event.dataTransfer) || ocrLoading) return
    event.preventDefault()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) setDragActive(false)
  }

  const onPageDrop = (event) => {
    if (!dataTransferHasImage(event.dataTransfer) || ocrLoading) return
    event.preventDefault()
    dragDepthRef.current = 0
    setDragActive(false)
    setImageUploadOpen(true)
    addPendingImages(event.dataTransfer?.files)
  }

  return (
    <div
      className={`page ${dragActive ? 'page-drag-active' : ''}`.trim()}
      onDragEnter={onPageDragEnter}
      onDragOver={onPageDragOver}
      onDragLeave={onPageDragLeave}
      onDrop={onPageDrop}
    >
      <header className="topbar">
        <h1>DumbReader</h1>
        <div className="topbar-actions">
          <button
            type="button"
            className="upload-btn upload-icon-btn"
            aria-label="Paste text and import"
            data-tooltip="Paste text and format it as Markdown"
            onClick={() => setTextImportOpen(true)}
          >
            <Clipboard size={16} />
          </button>
          <button
            type="button"
            className="upload-btn upload-icon-btn"
            aria-label="Open image upload panel"
            data-tooltip={ocrLoading ? 'Generating Markdown...' : 'Open image upload panel'}
            onClick={() => setImageUploadOpen(true)}
            disabled={ocrLoading}
          >
            {ocrLoading ? <LoaderCircle size={16} className="icon-spin" /> : <Upload size={16} />}
          </button>
          <input
            id="upload-image"
            ref={imageInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={onUploadImage}
            disabled={ocrLoading}
            hidden
          />
        </div>
      </header>

      {textImportOpen ? (
        <div className="text-import-overlay" onMouseDown={() => (textImportLoading ? null : setTextImportOpen(false))}>
          <div className="text-import-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="text-import-title">Import text and format as Markdown</div>
            <textarea
              className="text-import-input"
              placeholder="Paste messy text here..."
              value={textImportValue}
              onChange={(e) => setTextImportValue(e.target.value)}
              disabled={textImportLoading}
            />
            <div className="text-import-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setTextImportOpen(false)}
                disabled={textImportLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={onImportTextToMarkdown}
                disabled={!textImportValue.trim() || textImportLoading}
              >
                {textImportLoading ? 'Importing...' : 'Import'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {imageUploadOpen ? (
        <div className="text-import-overlay" onMouseDown={() => (ocrLoading ? null : setImageUploadOpen(false))}>
          <div className="image-upload-modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="text-import-title">Upload images</div>
            <div className="image-upload-hint">
              Select files or paste images (Ctrl+V) into this window. Images stay in queue until you click Process.
            </div>
            <div className="image-upload-actions-top">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => imageInputRef.current?.click()}
                disabled={ocrLoading}
              >
                Choose images
              </button>
              <span className="image-upload-count">Pending: {pendingImages.length}</span>
            </div>
            <div className="pending-image-list">
              {pendingImages.length === 0 ? (
                <div className="saved-empty">No pending images. Choose files or paste screenshots.</div>
              ) : (
                pendingImages.map((item, index) => (
                  <div key={item.id} className="pending-image-item">
                    <img
                      src={item.previewUrl}
                      alt={item.file?.name || `pending-image-${index + 1}`}
                      className="pending-image-thumb"
                      role="button"
                      tabIndex={0}
                      onClick={() => setPreviewImage({ url: item.previewUrl, name: item.file?.name || `Image ${index + 1}` })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setPreviewImage({ url: item.previewUrl, name: item.file?.name || `Image ${index + 1}` })
                        }
                      }}
                    />
                    <div className="pending-image-meta">
                      <div className="pending-image-name">{item.file?.name || `pasted-image-${index + 1}.png`}</div>
                      <div className="pending-image-size">{Math.max(1, Math.round((item.file?.size || 0) / 1024))} KB</div>
                    </div>
                    <button
                      type="button"
                      className="saved-delete-btn"
                      title="Remove"
                      aria-label="Remove pending image"
                      onClick={() => removePendingImage(item.id)}
                      disabled={ocrLoading}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <div className="text-import-actions">
              <button
                type="button"
                className="secondary-btn"
                onClick={() => setImageUploadOpen(false)}
                disabled={ocrLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={clearPendingImages}
                disabled={ocrLoading || pendingImages.length === 0}
              >
                Clear queue
              </button>
              <button
                type="button"
                className="secondary-btn"
                onClick={onProcessPendingImages}
                disabled={ocrLoading || pendingImages.length === 0}
              >
                {ocrLoading ? 'Processing...' : 'Process'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {previewImage ? (
        <div className="image-preview-overlay" onMouseDown={() => setPreviewImage(null)}>
          <div className="image-preview-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="image-preview-head">
              <div className="image-preview-name" title={previewImage.name}>
                {previewImage.name}
              </div>
              <button type="button" className="secondary-btn" onClick={() => setPreviewImage(null)}>
                Close
              </button>
            </div>
            <div className="image-preview-body">
              <img src={previewImage.url} alt={previewImage.name} className="image-preview-full" />
            </div>
          </div>
        </div>
      ) : null}

      <div className="saved-hover-control">
        <button
          type="button"
          className={`saved-tab-btn ${savedPanelOpen ? 'saved-tab-btn-open' : ''}`}
          onClick={() => setSavedPanelOpen((v) => !v)}
          title="Markdown history"
        >
          Saved Markdown
          <ChevronDown size={14} className="saved-tab-icon" />
        </button>
      </div>

      <div className={`saved-tab-panel ${savedPanelOpen ? 'saved-tab-panel-open' : ''}`}>
        <div className="card saved-tab-panel-inner">
          <div className="saved-head">
            <h2>Saved Markdown</h2>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => void refreshSavedFiles()}
              disabled={savedLoading}
            >
              {savedLoading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
          <div className="saved-list">
            {savedFiles.length === 0 ? (
              <div className="saved-empty">No history yet. Upload and parse an image first.</div>
            ) : (
              savedFiles.map((name) => (
                <div key={name} className={`saved-item-row ${activeSavedFile === name ? 'saved-item-active' : ''}`}>
                  <button
                    type="button"
                    className="saved-item"
                    onClick={() => void onOpenSavedFile(name)}
                    title={name}
                  >
                    {name}
                  </button>
                  <button
                    type="button"
                    className="saved-delete-btn"
                    title="Delete"
                    aria-label={`Delete ${name}`}
                    onClick={() => void onDeleteSavedFile(name)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <main className="layout">
        <section className="reader-col">
          <div className="card">
            <h2>Markdown Preview (Ctrl + Click to select words)</h2>
            <div className="markdown-preview" ref={previewRef}>
              <ReactMarkdown
                rehypePlugins={[rehypeRaw]}
                components={{
                  p: ({ children }) => (
                    <InteractiveTextBlock
                      as="p"
                      blockId={stableTextId(extractTextFromChildren(children), 'p')}
                      selectedSet={selectedSet}
                      onWordCtrlClick={onWordCtrlClick}
                      onSentenceContextMenu={onSentenceContextMenu}
                      copiedTokenKey={copiedTokenKey}
                      onCopyWord={(tokenKey, word) => {
                        navigator.clipboard.writeText(word).catch(() => {})
                        showCopiedFeedback(tokenKey)
                      }}
                    >
                      {children}
                    </InteractiveTextBlock>
                  ),
                  li: ({ children }) => (
                    <InteractiveTextBlock
                      as="li"
                      blockId={stableTextId(extractTextFromChildren(children), 'li')}
                      selectedSet={selectedSet}
                      onWordCtrlClick={onWordCtrlClick}
                      onSentenceContextMenu={onSentenceContextMenu}
                      copiedTokenKey={copiedTokenKey}
                      onCopyWord={(tokenKey, word) => {
                        navigator.clipboard.writeText(word).catch(() => {})
                        showCopiedFeedback(tokenKey)
                      }}
                    >
                      {children}
                    </InteractiveTextBlock>
                  ),
                }}
              >
                {markdown}
              </ReactMarkdown>
            </div>
          </div>

          <div className="card">
            <h2>Extracted Context</h2>
            <pre className="context-block">{contextPrompt || 'Select words above with Ctrl + Click first.'}</pre>
            <div className="context-actions">
              <button
                type="button"
                className="secondary-btn"
                disabled={!contextPrompt}
                onClick={injectPromptToAssistant}
              >
                Inject into chat input
              </button>
              <button
                type="button"
                className="secondary-btn"
                disabled={!selected.length}
                onClick={clearSelectedContext}
              >
                Clear selection
              </button>
            </div>
          </div>
        </section>
      </main>
      {contextMenu.open ? (
        <div
          className="sentence-context-menu"
          style={{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={addSentenceToAssistantContext}>
            Add to context
          </button>
          <button type="button" onClick={askSentenceMeaning}>
            Ask
          </button>
        </div>
      ) : null}
      {dragActive ? (
        <div className="drop-overlay" role="status" aria-live="polite">
          <div className="drop-overlay-card">松开以上传图片</div>
        </div>
      ) : null}
      <KnowledgeGraphAssistantChat />
    </div>
  )
}

export default App
