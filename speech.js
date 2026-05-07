import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import { Lunar } from 'lunar-typescript'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

/**
 * PCM -> WAV
 */
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

/**
 * 构建新闻播报 SSML
 */
function buildSSML(newsText) {
  const nowDate = new Date()
  const lunar = Lunar.fromDate(nowDate)

  const today = {
    month: nowDate.getMonth() + 1,
    day: nowDate.getDate(),
    week: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][nowDate.getDay()],
    lunarCalendar: `${lunar.getMonthInChinese()}月${lunar.getDayInChinese()}`,
  }

  return `
<speak>
  [news anchor]
  [professional]
  [slightly fast paced]
  [clear pronunciation]

  <p>
    早上好。
    <break time="500ms"/>

    这里是每天一分钟，速知天下事。
    <break time="700ms"/>

    今天是${today.month}月${today.day}日，
    ${today.week}，
    农历${today.lunarCalendar}。
    <break time="700ms"/>

    下面为大家播报今日早报。
  </p>

  <break time="1s"/>

  <p>
    ${newsText}
  </p>
</speak>
`
}

/**
 * 生成新闻语音
 */
async function generateNewsBroadcast(newsText) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-tts-preview',
  })

  const ssml = buildSSML(newsText)

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `
请使用中文新闻电台播报风格朗读以下 SSML 内容。

要求：
- 女声
- 新闻主播风格
- 语速稍快
- 自然
- 专业
- 不要机械感

SSML：

${ssml}
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
            voiceName: 'Aoede',
          },
        },
      },
    },
  })

  const response = result.response

  const part = response.candidates?.[0]?.content?.parts?.[0]

  if (!part?.inlineData?.data) {
    console.error(JSON.stringify(response, null, 2))
    throw new Error('没有返回音频数据')
  }

  // base64 -> PCM
  const pcmBuffer = Buffer.from(part.inlineData.data, 'base64')

  // PCM -> WAV
  const wavBuffer = pcmToWav(pcmBuffer)

  fs.writeFileSync('news_broadcast.wav', wavBuffer)

  console.log('新闻播报 WAV 已生成')
}

/**
 * 示例新闻
 */
generateNewsBroadcast(`
1. OpenAI 发布全新模型，推理能力进一步增强。

2. 苹果正在测试新一代 AI Siri 功能。

3. 多地推进低空经济建设，无人机产业持续升温。

4. 国内多家新能源汽车企业公布四月销量数据。
`).catch(console.error)
