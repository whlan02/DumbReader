import { useState } from 'react'
import { Check, Copy, RefreshCw } from 'lucide-react'
import { Button } from '../ui/button'
import { AssistantChatAssistantTextPart } from './AssistantChatAssistantTextPart'
import { useKnowledgeGraphAssistantChat } from './KnowledgeGraphAssistantChatContext'

export function AssistantChatAssistantMessage({ message }) {
  const { reloadAssistant, copyText, isRunning } = useKnowledgeGraphAssistantChat()
  const [copied, setCopied] = useState(false)
  const streaming = Boolean(message.streaming)
  const showActions = !streaming

  const onCopy = async () => {
    await copyText(message.text)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="kg-chat-message kg-chat-message-assistant">
      <div className="kg-chat-message-body kg-chat-message-body-assistant">
        <AssistantChatAssistantTextPart text={message.text} streaming={streaming} />
        {message.error ? (
          <div className="kg-chat-error" role="alert">
            {message.error}
          </div>
        ) : null}
        {showActions ? (
          <div className="kg-chat-actionbar">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onCopy}
              className="kg-chat-action kg-chat-copy-action h-7 w-7"
              title="Copy"
              disabled={!message.text}
            >
              {copied ? <Check className="kg-chat-check-icon size-[13px]" /> : <Copy className="kg-chat-copy-icon size-[13px]" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => reloadAssistant(message.id)}
              className="kg-chat-action h-7 w-7"
              title="Retry"
              disabled={isRunning}
            >
              <RefreshCw className="size-[13px]" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
