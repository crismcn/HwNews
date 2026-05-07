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
    <break time="300ms"/>
    这里是每天一分钟，速知天下事。
    <break time="300ms"/>
    今天是${today.month}月${today.day}日，
    ${today.week}，
    农历${today.lunarCalendar}。
    <break time="400ms"/>
    下面为大家播报今日早报。
  </p>
  <break time="600"/>
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
            voiceName: 'Leda',
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
1、今年“五一”假期民航日均客流量210.8万人次，同比下降5.74%，系疫情后首次负增长；

2、“五一”假期全国出入境人员达1127.9万人次，较去年同期增长3.5%；其中外国人入出境125.5万人次，同比增长3.5%；

3、广州“五一”假期一手住宅认购量同比增长超50%；深圳“五一”假期楼市签约量创6年新高，有盘40分钟售罄；

4、离岸人民币兑美元汇率升破6.81关口，创下2023年2月中旬以来的新高；

5、宁夏一5A级景区对“零低彩礼”新人免票，工作人员：实施近两年，已有新人凭证免费入园；

6、中国航天员中心招募卧床实验志愿者：参与者需全程卧床15至60天，最高可获7万元补助；

7、2026世界杯转播权陷天价僵局：FIFA报价2.5亿美元，中印等多国仍未签约；

8、国际奥委会已叫停并暂缓电竞奥运会计划；国足6月5日客战新加坡，双方FIFA排名相差53位；

9、三星电子宣布：停止在中国大陆市场销售所有家电产品，含电视、冰箱、洗衣机等，手机仍正常销售；

10、韩媒：韩国民调显示，韩国民众对中国的平均好感度为30.2分，创下六年新高；

11、外媒：印尼考虑对16岁以下人群实施“网购禁令”，此前已实施针对16岁以下人群的“社媒禁令”；

12、外媒：新西兰将推出入籍考试制度，申请者需通过20道英语多选题考试，内容涵盖政府架构、法律等；

13、美媒：美军部署超10万个人工智能体，欲打造“算法铁幕”谋求算法霸权；

14、外媒：特朗普宣布暂停霍尔木兹海峡护航行动，伊朗称特朗普此举是为掩盖计划的失败；

15、美媒：白宫认为与伊朗接近达成停战谅解备忘录；特朗普称若伊朗同意美方条款，“史诗怒火”行动将宣告结束；
`).catch(console.error)
