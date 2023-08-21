import { getSession } from '@auth0/nextjs-auth0'
import clientPromise from 'lib/mongodb'
import { ObjectId } from 'mongodb'

export default async function handler(req, res) {
  try {
    const { user } = await getSession(req, res)
    const client = await clientPromise
    const db = client.db('ChattyPete')

    const { chatId, role, content } = req.body
    console.log('chatId: ', chatId, 'role: ', role, 'content: ', content)

    let objectId

    try {
      objectId = new ObjectId(chatId)
    } catch (e) {
      res.status(422).json({
        message: 'Invalid chat ID',
      })
      return
    }

    const chat = await db.collection('chats').findOneAndUpdate(
      {
        _id: objectId,
        userId: user.sub,
      },
      {
        $push: {
          messages: {
            role,
            content,
          },
        },
      },
      {
        returnDocument: 'after',
      }
    )

    res.status(200).json({
      chat: {
        ...chat.value,
        id_: chat.value._id.toString(),
      },
    })
  } catch (e) {
    res
      .status(500)
      .json({ message: 'an error occurred when adding a message to a chat' })
  }
}
