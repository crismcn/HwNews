import { chromium } from 'playwright'
import fs from 'fs/promises'

const APIDICT = {
  recommend_newspaper: `https://newsfeed-drcn.cloud.dbankcloud.cn/infoflow/v2/recommend_newspaper?channelId=-1&count=4&refresh=001&cachedCount=0`,
  recommend_newspaper_more: `https://newsfeed-drcn.cloud.dbankcloud.cn/infoflow/v2/recommend_newspaper_more?channelId=-1&count=15&refresh=001&cachedCount=0`,
}

const _URL_ =
  'https://feeds-drcn.cloud.huawei.com.cn/landingpage/latest?docid=103666Topic_5f57284795e5493f958540a4317c9e33&to_app=hwbrowser&dy_scenario=topicinside&tn=90a3f8a6639eaa065d8b9312976ab5dd0e70790f700453f6b86554f3a3d0d93e&channel=-1&ctype=topic&cpid=666&r=CN&share_to=system#/newspaper'

// 创建浏览器实例(无头模式)
const browser = await chromium.launch({ headless: true })
const OPEN_URL_WASH_DATA = async (url, cb) => {
  const collectedData = []
  // 1. 新建页面
  const page = await browser.newPage()

  // 2. 监听网络请求
  page.on('response', async (response) => {
    const result = await cb(response)
    if (result) {
      collectedData.push(result)
    }
  })
  // 3. 打开指定url
  await page.goto(url, { waitUntil: 'networkidle' })

  // 4. 向下滑动到底部
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0
      const distance = 100
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight
        window.scrollBy(0, distance)
        totalHeight += distance

        if (totalHeight >= scrollHeight) {
          clearInterval(timer)
          resolve()
        }
      }, 100)
    })
  })
  // 5. 等待页面加载完成
  await page.waitForTimeout(2000)
  await page.close()

  // 展平所有收集到的数据
  return collectedData.flat()
}

// 获取今日新闻链接
const getTodayNewsUrl = async (response) => {
  const request = response.request()
  const requestUrl = request.url()
  if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
    try {
      // 检查响应类型
      if (APIDICT.recommend_newspaper_more == requestUrl) {
        const data = await response.json()
        if (data.result && Array.isArray(data.result)) {
          const categorys = data.result.map((item) => {
            const { recommendTitle } = item.newspaperInfo

            const { url } = item.shareInfoList[0].shareLinkList[0]
            return {
              url: url,
              title: recommendTitle,
              realDate: item.realDate,
            }
          })
          return categorys
        }
      }
    } catch (error) {}
  }
}

// 获取今日新闻数据
const getTodayNews = async (response) => {
  const request = response.request()
  const requestUrl = new URL(request.url())
  if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
    try {
      // 检查响应类型
      if (APIDICT.recommend_newspaper == requestUrl) {
        const data = await response.json()
        return data.result
          .filter((item) => item.realCpID != item.cpID)
          .map((item) => {
            const { id, url, title, summary, source, image, realDate } = item
            return {
              id,
              url,
              title,
              summary,
              author: source,
              image,
              realDate,
            }
          })
      }
    } catch (error) {}
  }
}

// 持久化数据到文件
const persistenceData = async (data, filename) => {
  try {
    const filePath = `./${filename}.json`
    const jsonContent = JSON.stringify(data, null, 2)
    await fs.writeFile(filePath, jsonContent, 'utf-8')
    console.log(`今日共写入 ${data.length} 条${filename}新闻数据`)
  } catch (error) {
    console.error('写入文件失败', error)
  }
}

;(async () => {
  const categorys = await OPEN_URL_WASH_DATA(_URL_, getTodayNewsUrl)

  // 国际早报
  const globalNews = categorys.find((item) => item.title == '每日国际早报') || { url: '', title: '' }
  if (globalNews.url) {
    const newsList = await OPEN_URL_WASH_DATA(globalNews.url, getTodayNews)
    await persistenceData(newsList, globalNews.title)
  }

  // 科技早报
  const technologyNews = categorys.find((item) => item.title == '每日科技早报') || { url: '', title: '' }
  if (technologyNews.url) {
    const newsList = await OPEN_URL_WASH_DATA(technologyNews.url, getTodayNews)
    await persistenceData(newsList, technologyNews.title)
  }

  await browser.close()
})()
