import { OpenAIEdgeStream } from 'openai-edge-stream'

export const config = {
  runtime: 'edge',
}

export default async function handler(req) {
  try {
    const { chatId: chatIdFromParam, message } = await req.json()
    let chatId = chatIdFromParam
    console.log('MESSAGE: ', message)

    const initialChatMessage = {
      role: 'system',
      content:
        'Your name is Chatty Pete. You are an incredibly intelligent and quick thinking AI that always replies with an enthusiastic and positive energy. You were created by Scott Huchton. Your response must be formatted as markdown.',
    }

    let newChatId
    let chatMessages = []

    if (chatId) {
      // Add message to existing chat
      const resp = await fetch(
        `${req.headers.get('origin')}/api/chat/addMessageToChat`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: req.headers.get('cookie'),
          },
          body: JSON.stringify({
            chatId,
            role: 'user',
            content: message,
          }),
        }
      )
      const json = await resp.json()
      chatMessages = json.chat.messages || []
    } else {
      const response = await fetch(
        `${req.headers.get('origin')}/api/chat/createNewChat`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            cookie: req.headers.get('cookie'),
          },
          body: JSON.stringify({
            message,
          }),
        }
      )
      const json = await response.json()
      chatId = json._id
      newChatId = json._id
      chatMessages = json.messages || []
    }

    const messagesToInclude = []
    // chatMessages are ordered oldest to newest, but we want to include the
    // newest messages, so reverse the array
    chatMessages.reverse()
    let usedTokens = 0
    for (let chatMessage of chatMessages) {
      // This is a rough estimation
      const messageTokens = chatMessage.content.length / 4
      usedTokens = usedTokens + messageTokens
      if (usedTokens <= 2000) {
        messagesToInclude.push(chatMessage)
      } else {
        break
      }
    }
    // ChatGPT expects the messages in oldest to newest, so reverse again
    messagesToInclude.reverse()

    const stream = await OpenAIEdgeStream(
      'https://api.openai.com/v1/chat/completions',
      {
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        method: 'POST',
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [initialChatMessage, ...messagesToInclude],
          stream: true,
        }),
      },
      {
        onBeforeStream: ({ emit }) => {
          if (newChatId) {
            emit(newChatId, 'newChatId')
          }
        },
        onAfterStream: async ({ fullContent }) => {
          await fetch(
            `${req.headers.get('origin')}/api/chat/addMessageToChat`,
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                cookie: req.headers.get('cookie'),
              },
              body: JSON.stringify({
                chatId,
                role: 'assistant',
                content: fullContent,
              }),
            }
          )
        },
      }
    )
    return new Response(stream)
  } catch (e) {
    console.log('AN ERROR OCCURED IN SENDMESSAGE> ', e)
  }
}
