const fs = require('fs')
const path = require('path')
require('expect-puppeteer')

page.setDefaultTimeout(10000)
const port = 8080
const urlModel = (name) => `http://localhost:${port}/?m=${name}`

// Get all model names from `example` folder
const modelNames = fs
  .readdirSync(path.join(__dirname, './examples'))
  .filter(name => name.endsWith('.json'))
  .map(name => name.replace('.json', ''))

describe('Examples', () => {
  // Load a model and check if it has a block, run it and check the result
  test.each(modelNames)('Check: http://localhost:8080/?m=%s', async (modelName) => {
    await page.setViewport({ width: 1920, height: 1080 })
    await page.goto(urlModel(modelName))
    await page.waitForSelector('#btn-run', { timeout: 2000 }) // Change to btn-run as .block is not always present (e.g. flow)
    await page.screenshot({ path: `./tmp/screenshot_all_${modelName}_1.png` })
    await expect(page).toClick('#btn-run')
    await page.waitForSelector('.result-header', { timeout: 20000 })
    await page.screenshot({ path: `./tmp/screenshot_all_${modelName}_2.png` })
  }, 20000)
})