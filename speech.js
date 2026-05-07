import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import { Lunar } from 'lunar-typescript'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

function pcmToWav(pcmData, sampleRate = 24000, channels = 1, bitDepth = 16) {
  const header = Buffer.alloc(44)

  const byteRate = (sampleRate * channels * bitDepth) / 8
  const blockAlign = (channels * bitDepth) / 8

  header.write('RIFF', 0)
  header.writeUInt32LE(36 + pcmData.length, 4)
  header.write('WAVE', 8)

  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(channels, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(byteRate, 28)
  header.writeUInt16LE(blockAlign, 32)
  header.writeUInt16LE(bitDepth, 34)

  header.write('data', 36)
  header.writeUInt32LE(pcmData.length, 40)

  return Buffer.concat([header, pcmData])
}

function buildNewsText(text) {
  const nowDate = new Date()
  const lunar = Lunar.fromDate(nowDate)

  const today = {
    month: nowDate.getMonth() + 1,
    day: nowDate.getDate(),
    week: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][nowDate.getDay()],
    lunarCalendar: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
  }

  const morning = `早上好，这里是每天一分钟·速知天下事。` + `今天是${today.month}月${today.day}日${today.week}，` + `农历${today.lunarCalendar}。` + `下面为大家播报今日早报。`

  return `[speed: fast]${morning}\n${text}`
}

async function generateNewsBroadcast(text) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash-preview-tts',
  })

  const finalText = buildNewsText(text)

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `
请使用中文新闻联播风格播报以下内容：

要求：
- 女声
- 温柔且专业
- 有新闻播音感
- 节奏稍快
- 语气自然
- 段落间有轻微停顿
- 不要机器人语气
- 类似早间资讯电台

播报内容：

${finalText}
            `,
          },
        ],
      },
    ],

    generationConfig: {
      responseModalities: ['AUDIO'],

      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: 'Aoede', // 'Kore',
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

  const pcmBuffer = Buffer.from(part.inlineData.data, 'base64')

  const wavBuffer = pcmToWav(pcmBuffer)

  fs.writeFileSync('news_broadcast.wav', wavBuffer)

  console.log('新闻播报生成成功')
}

generateNewsBroadcast(`
1. OpenAI 发布新模型，推理能力进一步增强。

2. 苹果正在测试新一代 AI Siri 功能。

3. 多地推进低空经济建设，无人机产业持续升温。
`)
