import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs/promises'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GoogleAI = new GoogleGenerativeAI(GEMINI_API_KEY)

async function generateNewsBroadcast() {
  // 选择模型：gemini-3.1-flash-tts
  const model = GoogleAI.getGenerativeModel({ model: 'gemini-3.1-flash-tts-preview' })

  // 模拟新闻播报文案，使用音频标签控制节奏
  const prompt = `
    [scene: professional news studio, high clarity]
    [speaker: authoritative, male, clear articulation]
    
    各位听众大家好，欢迎收看今日科技快讯。
    
    [speed: slow] 首先关注一则国际消息：[pause: 500ms] 
    谷歌正式发布了 Gemini 3.1 Flash TTS 模型。
    
    [tone: exciting] 该模型在表现力上实现了质的飞跃！
    [speed: normal] 据悉，它支持超过70种语言，并能根据文本语境自动调整情绪。
    
    今天的播报到此结束，感谢您的收听。
  `

  try {
    const result = await model.generateContent(prompt)
    const response = await result.response

    // 提取音频数据 (通常以 Base64 或特定 Buffer 格式返回)
    // 注意：预览版 API 的具体字段可能会随 SDK 更新微调
    const audioData = response.audioContents[0]

    fs.writeFileSync('news_broadcast.mp3', Buffer.from(audioData, 'base64'))
    console.log('音频新闻已生成：news_broadcast.mp3')
  } catch (error) {
    console.error('生成失败:', error)
  }
}

generateNewsBroadcast()
