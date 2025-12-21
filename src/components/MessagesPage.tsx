import { useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import type { ChatSummary, MessageItem } from '../types'
import { formatTime, sanitizeNumber } from '../utils/chat'

type MessagesPageProps = {
  chats: ChatSummary[]
  activeChatId: string | null
  activeChat: ChatSummary | null
  currentUserId: string | null
  currentNumber: string
  displayPartnerNumber: string
  messages: MessageItem[]
  searchNumber: string
  chatError: string
  chatStreamError: string
  messageStreamError: string
  loadingProfile: boolean
  compose: string
  onSearchNumberChange: (value: string) => void
  onStartChat: (event: FormEvent<HTMLFormElement>) => void
  onSelectChat: (chatId: string) => void
  onComposeChange: (value: string) => void
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void
}

export const MessagesPage = ({
  chats,
  activeChatId,
  activeChat,
  currentUserId,
  currentNumber,
  displayPartnerNumber,
  messages,
  searchNumber,
  chatError,
  chatStreamError,
  messageStreamError,
  loadingProfile,
  compose,
  onSearchNumberChange,
  onStartChat,
  onSelectChat,
  onComposeChange,
  onSendMessage,
}: MessagesPageProps) => {
  const messageEndRef = useRef<HTMLDivElement | null>(null)
  const hasActiveChat = Boolean(activeChatId)

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <section className="chat-shell">
      <aside className="panel chat-panel">
        <div className="panel-header">
          <div>
            <h2>Chats</h2>
            <p>Start by entering a six-digit ID.</p>
          </div>
        </div>
        <form className="start-chat" onSubmit={onStartChat}>
          <input
            className="input"
            inputMode="numeric"
            maxLength={6}
            placeholder="Friend ID"
            value={searchNumber}
            onChange={(event) =>
              onSearchNumberChange(sanitizeNumber(event.target.value))
            }
            disabled={loadingProfile}
          />
          <button className="primary" type="submit" disabled={loadingProfile}>
            Start
          </button>
        </form>
        {chatError ? <p className="error">{chatError}</p> : null}
        {chatStreamError ? <p className="error">{chatStreamError}</p> : null}
        <div className="chat-list">
          {chats.length === 0 && !hasActiveChat ? (
            <div className="empty">No chats yet. Start one!</div>
          ) : (
            <>
              {hasActiveChat && !activeChat ? (
                <div className="chat-item pending">
                  <div>
                    <strong>{displayPartnerNumber || 'New chat'}</strong>
                    <span className="meta">Waiting for chat to sync...</span>
                  </div>
                  <span className="time">just now</span>
                </div>
              ) : null}
              {chats.map((chat) => {
                const label =
                  chat.participantNumbers?.find(
                    (number) => number !== currentNumber,
                  ) ?? 'Unknown'
                return (
                  <button
                    key={chat.id}
                    className={
                      chat.id === activeChatId
                        ? 'chat-item active'
                        : 'chat-item'
                    }
                    type="button"
                    onClick={() => onSelectChat(chat.id)}
                  >
                    <div>
                      <strong>{label}</strong>
                      <span className="meta">
                        {chat.lastMessage ? chat.lastMessage : 'No messages yet'}
                      </span>
                    </div>
                    <span className="time">{formatTime(chat.updatedAt ?? null)}</span>
                  </button>
                )
              })}
            </>
          )}
        </div>
      </aside>

      <section className="panel messages-panel">
        <div className="panel-header">
          <div>
            <h2>
              {displayPartnerNumber ? `Chat with ${displayPartnerNumber}` : 'Chat'}
            </h2>
            <p>{hasActiveChat ? 'Keep your clues discreet.' : 'Select a chat on the left.'}</p>
          </div>
          <span className="chip muted">
            {hasActiveChat ? `${messages.length} messages` : 'No chat selected'}
          </span>
        </div>
        {messageStreamError ? <p className="error">{messageStreamError}</p> : null}

        <div className="messages">
          {hasActiveChat ? (
            messages.length ? (
              messages.map((message) => {
                const isMine = message.senderId === currentUserId
                return (
                  <div
                    key={message.id}
                    className={isMine ? 'message-row mine' : 'message-row'}
                  >
                    <div
                      className={isMine ? 'bubble mine' : 'bubble'}
                    >
                      <p>{message.text}</p>
                    </div>
                    <span className={isMine ? 'message-meta mine' : 'message-meta'}>
                      {isMine
                        ? 'You'
                        : message.senderName ?? message.senderNumber ?? 'Friend'}{' '}
                      • {formatTime(message.createdAt ?? null)}
                    </span>
                  </div>
                )
              })
            ) : (
              <div className="empty">Share your first clue.</div>
            )
          ) : (
            <div className="empty">Pick a chat to see messages.</div>
          )}
          <div ref={messageEndRef} />
        </div>

        <form className="composer" onSubmit={onSendMessage}>
          <input
            className="input"
            placeholder={hasActiveChat ? 'Write a message...' : 'Select a chat first'}
            value={compose}
            onChange={(event) => onComposeChange(event.target.value)}
            disabled={!hasActiveChat}
          />
          <button className="primary" type="submit" disabled={!hasActiveChat}>
            Send
          </button>
        </form>
      </section>
    </section>
  )
}
