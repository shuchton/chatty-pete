import { ChatSidebar } from 'components/ChatSidebar'
import { Message } from 'components/Message'
import Head from 'next/head'
import { streamReader } from 'openai-edge-stream'
import { useState } from 'react'
import { v4 as uuid } from 'uuid'

export default function ChatPage() {
  const [messageText, setMessageText] = useState('')
  const [incomingMessage, setIncomingMessage] = useState('')
  const [newChatMessages, setNewChatMessages] = useState([])
  const [generatingResponse, setGeneratingResponse] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGeneratingResponse(true)
    setNewChatMessages((prev) => {
      const newChatMessages = [
        ...prev,
        {
          _id: uuid(),
          role: 'user',
          content: messageText,
        },
      ]
      return newChatMessages
    })
    setMessageText('')

    const resp = await fetch('/api/chat/sendMessage', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ message: messageText }),
    })
    const data = resp.body
    if (!data) {
      return
    }
    const reader = data.getReader()
    await streamReader(reader, (message) => {
      console.log('MESSAGE: ', message)
      setIncomingMessage((s) => `${s}${message.content}`)
    })

    setGeneratingResponse(false)
  }

  return (
    <>
      <Head>
        <title>New chat</title>
      </Head>
      <div className="grid h-screen grid-cols-[260px_1fr]">
        <ChatSidebar />
        <div className="flex flex-col overflow-hidden bg-gray-700">
          {/* chat window */}
          <div className="flex-1 overflow-y-auto text-white">
            {newChatMessages.map((m) => (
              <Message key={m._id} role={m.role} content={m.content} />
            ))}
            {!!incomingMessage && (
              <Message role="assistant" content={incomingMessage} />
            )}
          </div>
          <footer className="bg-gray-800 p-10">
            <form onSubmit={handleSubmit}>
              <fieldset className="flex gap-2" disabled={generatingResponse}>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder={generatingResponse ? '' : 'Send a message...'}
                  className="w-full resize-none rounded-md bg-gray-700 p-2 text-white focus:border-emerald-500 focus:bg-gray-600 focus:outline focus:outline-emerald-500"
                />
                <button type="submit" className="btn">
                  Send
                </button>
              </fieldset>
            </form>
          </footer>
        </div>
      </div>
    </>
  )
}
