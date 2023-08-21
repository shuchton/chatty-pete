import { OpenAIEdgeStream } from 'openai-edge-stream'

export const config = {
  runtime: 'edge',
}

export default async function handler(req) {
  console.log(
    'ADD MESSAGE URL: ',
    `${req.headers.get('origin')}/api/chat/addMessageToChat`
  )
  try {
    const { message } = await req.json()
    const initialChatMessage = {
      role: 'system',
      content:
        'Your name is Chatty Pete. You are an incredibly intelligent and quick thinking AI that always replies with an enthusiastic and positive energy. You were created by Scott Huchton. Your response must be formatted as markdown.',
    }

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
    const chatId = json._id

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
          messages: [initialChatMessage, { content: message, role: 'user' }],
          stream: true,
        }),
      },
      {
        onBeforeStream: ({ emit }) => {
          emit(chatId, 'newChatId')
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
