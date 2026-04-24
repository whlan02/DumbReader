import { ChevronDown } from 'lucide-react'
import { Button } from '../ui/button'
import ChatComposer from './ChatInput'
import { AssistantChatAssistantMessage } from './AssistantChatAssistantMessage'
import { AssistantChatUserMessage } from './AssistantChatUserMessage'
import { useKnowledgeGraphAssistantViewportScroll } from './useKnowledgeGraphAssistantViewportScroll'
import { useKnowledgeGraphAssistantChat } from './KnowledgeGraphAssistantChatContext'

export function AssistantChatThreadPanel() {
  const { messages } = useKnowledgeGraphAssistantChat()
  const { viewportRef, showScrollToBottom, scrollViewportToBottom } = useKnowledgeGraphAssistantViewportScroll()
  return (
    <div className="kg-chat-thread-root">
      <div className="kg-chat-viewport-stack">
        <div className="kg-chat-viewport" ref={viewportRef}>
          {messages.map((message) =>
            message.role === 'user' ? (
              <AssistantChatUserMessage key={message.id} message={message} />
            ) : (
              <AssistantChatAssistantMessage key={message.id} message={message} />
            ),
          )}
        </div>
        {showScrollToBottom ? (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="kg-chat-scroll-to-bottom"
            title="Scroll to bottom"
            aria-label="Scroll to bottom"
            onClick={() => scrollViewportToBottom('smooth')}
          >
            <ChevronDown className="size-[18px]" strokeWidth={2.25} />
          </Button>
        ) : null}
      </div>
      <div className="kg-chat-footer">
        <ChatComposer variant="main" placeholder="Ask me anything..." rows={1} cancelOnEscape autoFocus />
      </div>
    </div>
  )
}
