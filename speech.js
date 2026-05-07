import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

function pcmToWav(pcmData, sampleRate = 24000, channels = 1, bitDepth = 16) {
  const header = Buffer.alloc(44)

  const byteRate = (sampleRate * channels * bitDepth) / 8
  const blockAlign = (channels * bitDepth) / 8

  // RIFF
  header.write('RIFF', 0)

  // file length
  header.writeUInt32LE(36 + pcmData.length, 4)

  // WAVE
  header.write('WAVE', 8)

  // fmt chunk
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitDepth, 34)

  // data chunk
  header.write('data', 36)
  header.writeUInt32LE(pcmData.length, 40)

  return Buffer.concat([header, pcmData])
}

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

  const part = response.candidates?.[0]?.content?.parts?.[0]

  if (!part?.inlineData?.data) {
    console.log(JSON.stringify(response, null, 2))
    throw new Error('没有返回音频数据')
  }

  // base64 -> PCM
  const pcmBuffer = Buffer.from(part.inlineData.data, 'base64')

  // PCM -> WAV
  const wavBuffer = pcmToWav(pcmBuffer)

  fs.writeFileSync('news_broadcast.wav', wavBuffer)

  console.log('WAV 文件已生成')
}

generateNewsBroadcast().catch(console.error)
