import ChatComposer from './ChatInput'
import { useKnowledgeGraphAssistantChat } from './KnowledgeGraphAssistantChatContext'

export function AssistantChatUserMessage({ message }) {
  const { editingUserMessageId, startEditUser } = useKnowledgeGraphAssistantChat()
  const isEditing = editingUserMessageId === message.id

  return (
    <div className="kg-chat-message kg-chat-message-user">
      <div className="kg-chat-message-body">
        {!isEditing ? (
          <button
            type="button"
            className="kg-chat-bubble kg-chat-bubble-user kg-chat-bubble-user-editable"
            title="Click to edit and resend"
            onClick={() => startEditUser(message.id)}
          >
            <p className="kg-chat-text">{message.text}</p>
          </button>
        ) : (
          <div className="kg-chat-edit-wrap">
            <ChatComposer
              variant="edit"
              placeholder=""
              rows={1}
              cancelOnEscape
              autoFocus
              enableOutsideCancel
              editInitialText={message.text}
            />
          </div>
        )}
      </div>
    </div>
  )
}
