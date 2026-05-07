import { GoogleGenerativeAI } from '@google/generative-ai'
import fs from 'fs'
import ffmpeg from 'fluent-ffmpeg'
import ffmpegPath from 'ffmpeg-static'

ffmpeg.setFfmpegPath(ffmpegPath)

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

async function wavToMp3(wavPath, mp3Path) {
  return new Promise((resolve, reject) => {
    ffmpeg(wavPath).audioCodec('libmp3lame').audioBitrate('64k').audioChannels(1).audioFrequency(24000).save(mp3Path).on('end', resolve).on('error', reject)
  })
}

async function generateNewsBroadcast() {
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.1-flash-tts-preview',
  })

  const result = await model.generateContent({
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `
[news anchor]
[professional]
[slightly fast paced]

早上好，这里是：每天一分钟，速知天下事。
今天是05月07日 星期四 农历三月廿一
下面为大家播报今日早报。

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
            voiceName: 'Charon', // Aoede（最稳） Kore（偏清晰） Charon（偏播报）
          },
        },
      },
    },
  })

  const part = result.response.candidates?.[0]?.content?.parts?.[0]

  if (!part?.inlineData?.data) {
    throw new Error('没有返回音频')
  }

  // PCM
  const pcmBuffer = Buffer.from(part.inlineData.data, 'base64')

  // WAV
  const wavBuffer = pcmToWav(pcmBuffer)

  fs.writeFileSync('temp.wav', wavBuffer)

  // MP3
  await wavToMp3('temp.wav', 'news.mp3')

  // 删除临时wav
  fs.unlinkSync('temp.wav')

  console.log('MP3生成成功')
}

generateNewsBroadcast().catch(console.error)
