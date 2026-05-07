import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

async function generateNewsBroadcast() {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-preview-tts',
  })

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: '各位听众大家好，欢迎收看今日科技快讯。',
          },
        ],
      },
    ],

    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Kore',
          },
        },
      },
    },
  })

  const response = result.response

  const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data

  if (!audioData) {
    console.log(JSON.stringify(response, null, 2))
    throw new Error('没有返回音频数据')
  }

  const audioBuffer = Buffer.from(audioData, 'base64')

  fs.writeFileSync('news_broadcast.mp3', audioBuffer)

  console.log('语音生成成功')
}

generateNewsBroadcast().catch(console.error)
