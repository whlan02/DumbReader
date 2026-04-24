import { AssistantChatHeaderBar } from './AssistantChatHeaderBar'
import { AssistantChatThreadPanel } from './AssistantChatThreadPanel'
import { KnowledgeGraphAssistantChatProvider } from './KnowledgeGraphAssistantChatContext'
import './KnowledgeGraphAssistantChat.css'

function KnowledgeGraphAssistantChatInner() {
  return (
    <div className="kg-chat-modal kg-chat-fixed-panel">
      <AssistantChatHeaderBar />
      <AssistantChatThreadPanel />
    </div>
  )
}

export default function KnowledgeGraphAssistantChat() {
  return (
    <KnowledgeGraphAssistantChatProvider>
      <KnowledgeGraphAssistantChatInner />
    </KnowledgeGraphAssistantChatProvider>
  )
}
