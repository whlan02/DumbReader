import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function AssistantChatAssistantTextPart({ text, streaming }) {
  return (
    <div className="kg-chat-assistant-content">
      {streaming ? (
        <div className="kg-chat-md-plain">
          <p className="kg-chat-text kg-chat-text-stream">{text || ''}</p>
          <span className="kg-chat-cursor" aria-hidden>
            ▊
          </span>
        </div>
      ) : (
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{text || ''}</ReactMarkdown>
      )}
    </div>
  )
}
