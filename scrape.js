import { chromium } from 'playwright'

// 1. 启动浏览器
const browser = await chromium.launch({ headless: true })

const getTodayNews = async (url) => {
  // 2. 新建页面
  const page = await browser.newPage()

  // 3. 监听网络请求
  page.on('response', async (response) => {
    const request = response.request()
    const requestUrl = new URL(request.url())
    const params = requestUrl.searchParams
    if (request.resourceType() === 'xhr' || request.resourceType() === 'fetch') {
      try {
        // 检查响应类型
        const contentType = response.headers()['content-type']
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json()
          // 检查数据结构是否符合
          if (data.code == 0 && data.sourceInfoList && data.sourceInfoList.length) {
            console.log('今日资讯:')
            console.log(data.result)
            // TODO REQUEST NEWS API
          }
          if (params.get('count') == 15 && params.get('channelId') == -1) {
            console.log('今日栏目:')
            console.log(data.result)
            // # globalNews ==>> category: "4101000000"
            // # globalNews ==>> category: "4101000000"
          }
        }
      } catch (error) {}
    }
  })

  // 4. 打开指定url
  await page.goto(url, { waitUntil: 'networkidle' })

  // 5. 向下滑动到底部
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
  // 等待页面加载完成
  await page.waitForTimeout(2000)
  await browser.close()
}

const url =
  'https://feeds-drcn.cloud.huawei.com.cn/landingpage/latest?docid=103666Topic_1b5978b7664349adbd5b6cab3184c4de&to_app=hwbrowser&dy_scenario=topicinside&tn=1a4f800b93e98d12ae426ff3739a777478437cbb531708d22394f556bac7b210&channel=-1&ctype=topic&cpid=666&r=CN&share_to=system#/newspaper'

getTodayNews(url)
