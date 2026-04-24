import { RefreshCcw } from 'lucide-react'
import { Button } from '../ui/button'
import { OPENROUTER_MODEL } from './knowledgeGraphAssistantOpenRouterConfig'
import { useKnowledgeGraphAssistantChat } from './KnowledgeGraphAssistantChatContext'
import dumbReaderLogo from '../../assets/IMAGE/DumbReader.png'

export function AssistantChatHeaderBar() {
  const { newSession } = useKnowledgeGraphAssistantChat()
  return (
    <div className="kg-chat-header">
      <div className="kg-chat-header-main">
        <div className="kg-chat-header-text">
          <div className="kg-chat-header-title">
            <img src={dumbReaderLogo} alt="DumbReader logo" className="kg-chat-header-logo" />
            <span>LLM Assistant</span>
          </div>
          <div className="kg-chat-header-desc">OpenRouter · {OPENROUTER_MODEL}</div>
        </div>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={newSession}
        className="kg-chat-new-session -mr-1 ml-0 size-9 rounded-[10px] p-0"
        title="New session (clear current conversation)"
        aria-label="New session"
      >
        <RefreshCcw className="size-[18px]" strokeWidth={2} />
      </Button>
    </div>
  )
}
