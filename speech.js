import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs/promises'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GoogleAI = new GoogleGenerativeAI(GEMINI_API_KEY)

async function generateNewsBroadcast() {
  // 1. 确保模型名称完全匹配预览版 ID
  const model = GoogleAI.getGenerativeModel({
    model: 'gemini-3.1-flash-tts-preview',
  })

  const prompt = '各位听众大家好，欢迎收看今日科技快讯。'

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      // 2. 必须指定 generationConfig，否则模型不知道该返回文本还是音频
      generationConfig: {
        responseMimeType: 'audio/mpeg',
      },
    })

    const response = await result.response

    // 3. 获取音频数据
    // 在 Gemini 3.1 TTS 中，音频通常存在于 dataContents 或特定的 candidate 中
    const audioPart = response.candidates[0].content.parts.find((p) => p.inlineData)

    if (audioPart) {
      const buffer = Buffer.from(audioPart.inlineData.data, 'base64')
      fs.writeFileSync('news_broadcast.mp3', buffer)
      console.log('音频新闻已生成：news_broadcast.mp3')
    } else {
      console.log('未找到音频数据，请检查响应内容：', JSON.stringify(response, null, 2))
    }
  } catch (error) {
    // 如果还是 400，打印详细错误
    console.error('生成失败:', error.message)
    if (error.errorDetails) {
      console.error('详细错误信息:', JSON.stringify(error.errorDetails, null, 2))
    }
  }
}

generateNewsBroadcast()
