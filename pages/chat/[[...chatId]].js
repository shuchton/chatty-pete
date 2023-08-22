import { getSession } from '@auth0/nextjs-auth0'
import { faRobot } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ChatSidebar } from 'components/ChatSidebar'
import { Message } from 'components/Message'
import clientPromise from 'lib/mongodb'
import { ObjectId } from 'mongodb'
import { generateBuildId } from 'next.config'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { streamReader } from 'openai-edge-stream'
import { useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'

export default function ChatPage({ chatId, title, messages = [] }) {
  console.log('props: ', title, messages)
  const [messageText, setMessageText] = useState('')
  const [incomingMessage, setIncomingMessage] = useState('')
  const [newChatMessages, setNewChatMessages] = useState([])
  const [generatingResponse, setGeneratingResponse] = useState(false)
  const [newChatId, setNewChatId] = useState(null)
  const [fullMessage, setFullMessage] = useState('')
  const [originalChatId, setOriginalChatId] = useState(chatId)

  const router = useRouter()

  const routeHasChanged = chatId !== originalChatId

  // Reset state items when route changes
  useEffect(() => {
    setNewChatMessages([])
    setNewChatId(null)
  }, [chatId])

  // Save the newly streamed message to newChatMessages
  useEffect(() => {
    if (!routeHasChanged && !generatingResponse && fullMessage) {
      setNewChatMessages((prev) => [
        ...prev,
        {
          _id: uuid(),
          role: 'assistant',
          content: fullMessage,
        },
      ])
      setFullMessage('')
    }
  }, [generatingResponse, fullMessage, routeHasChanged])

  // Navigate to new chat page when we create a chat
  useEffect(() => {
    if (!generatingResponse && newChatId) {
      setNewChatId(null)
      router.push(`/chat/${newChatId}`)
    }
  }, [newChatId, generatingResponse, router])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setGeneratingResponse(true)
    setOriginalChatId(chatId)
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
      body: JSON.stringify({ chatId, message: messageText }),
    })
    const data = resp.body
    if (!data) {
      return
    }
    const reader = data.getReader()
    let content = ''
    await streamReader(reader, (message) => {
      console.log('MESSAGE: ', message)
      if (message.event === 'newChatId') {
        setNewChatId(message.content)
      } else {
        setIncomingMessage((s) => `${s}${message.content}`)
        content = content + message.content
      }
    })

    setFullMessage(content)
    setIncomingMessage('')
    setGeneratingResponse(false)
  }

  const allMessages = [...messages, ...newChatMessages]

  return (
    <>
      <Head>
        <title>New chat</title>
      </Head>
      <div className="grid h-screen grid-cols-[260px_1fr]">
        <ChatSidebar chatId={chatId} />
        <div className="flex flex-col overflow-hidden bg-gray-700">
          {/* chat window */}
          <div className="flex flex-1 flex-col-reverse overflow-y-auto text-white">
            {!allMessages.length && !incomingMessage && (
              <div className="m-auto flex items-center justify-center text-center">
                <div>
                  <FontAwesomeIcon
                    icon={faRobot}
                    className="text-6xl text-emerald-200"
                  />
                  <h1 className="mt-2 text-4xl font-bold text-white/50">
                    Ask me a question!
                  </h1>
                </div>
              </div>
            )}
            {!!allMessages.length && (
              <div className="mb-auto">
                {allMessages.map((m) => (
                  <Message key={m._id} role={m.role} content={m.content} />
                ))}
                {!!incomingMessage && !routeHasChanged && (
                  <Message role="assistant" content={incomingMessage} />
                )}
                {!!incomingMessage && routeHasChanged && (
                  <Message
                    role="notice"
                    content="Only one message at a time. Please allow any other responses to complete before sending another message."
                  />
                )}
              </div>
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

export const getServerSideProps = async (ctx) => {
  const chatId = ctx.params?.chatId?.[0] || null
  if (chatId) {
    // validate the chatId
    let objectId
    try {
      objectId = new ObjectId(chatId)
    } catch (e) {
      return {
        redirect: {
          destination: '/chat',
        },
      }
    }
    const { user } = await getSession(ctx.req, ctx.res)
    const client = await clientPromise
    const db = client.db('ChattyPete')
    const chat = await db.collection('chats').findOne({
      userId: user.sub,
      _id: objectId,
    })
    if (!chat) {
      return {
        redirect: {
          destination: '/chat',
        },
      }
    }
    return {
      props: {
        chatId,
        title: chat.title,
        messages: chat.messages.map((msg) => ({
          ...msg,
          _id: uuid(),
        })),
      },
    }
  }
  return {
    props: {},
  }
}
