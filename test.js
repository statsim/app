require('expect-puppeteer')

page.setDefaultTimeout(10000)

const createLink = require('./src/lib/createLink')

const port = 8080
const urlModel = (name) => `http://localhost:${port}/?m=${name}`

async function waitForText (page, text) {
  await page.waitForFunction(
    `document.querySelector("body").innerText.includes("${text}")`,
    { timeout: 1000}
  )
} 

async function waitForNoText (page, text) {
  await page.waitForFunction(
    `!document.querySelector("body").innerText.includes("${text}")`,
    { timeout: 1000}
  )
} 

// await new Promise(resolve => setTimeout(resolve, 1000))
describe('Block examples', () => {
  const modelName = 'data_input'
  const model = require(`./test/${modelName}.json`)[0]
  const expectedValue = parseFloat(model.blocks[0].value)

  test('Load, run, check gaussian', async () => {
    await page.goto(urlModel('test/' + modelName + '.json'))
    await page.setViewport({ width: 1920, height: 1080 })
    await page.waitForSelector('.block')
    await expect(page).toMatchTextContent('Variable')
    await expect(page).toClick('#btn-run')
    await page.waitForSelector('.result-value')
    const resultValue = await page.$eval('.result-value', el => parseFloat(el.textContent))
    expect(Math.abs(resultValue - expectedValue) < 5).toBe(true)
  })

  test('Add new block (Expression), set value, disable output, run', async () => {
    await page.goto(urlModel('test/' + modelName + '.json'))
    await page.setViewport({ width: 1920, height: 1080 })
    await page.waitForSelector('.block')
    await expect(page).toClick('#btn-add-block', { text: 'Add block' })
    await new Promise(resolve => setTimeout(resolve, 1000))
    await expect(page).toClick('.menu-add-block', { text: 'Expression' })
    await page.waitForSelector('.block-1') // Expression block
    await expect(page).toMatchTextContent('Expression')
    await expect(page).toClick('label', { text: 'expression' })
    await new Promise(resolve => setTimeout(resolve, 100))
    await page.keyboard.type('R0 + 1000')
    await expect(page).toClick('button', { text: 'Output' })
    await new Promise(resolve => setTimeout(resolve, 1000))
    await expect(page).toClick('label', { text: 'R0' })
    await expect(page).toClick('#btn-run')
    await page.waitForSelector('.result-value')
    const resultValue = await page.$eval('.result-value', el => parseFloat(el.textContent))
    expect(Math.abs(resultValue - (expectedValue + 1000)) < 5).toBe(true)
    await page.screenshot({ path: `./tmp/screenshot_blocks_${modelName}.png` })
  })
})


describe('Z3 (SMT)', () => {
  const modelName = 'bananas'
  test(modelName, async () => {
    await page.goto(urlModel(modelName))
    await page.waitForSelector('.block')
    await expect(page).toClick('#btn-run')
    await page.waitForSelector('.result-value')
    await expect(page).toMatchTextContent('sat')
    await expect(page).toMatchTextContent('63') // Mangoes
    await page.screenshot({ path: `./tmp/screenshot_z3_${modelName}.png` })
  })
})

describe('Flow', () => {
  const modelName1 = 'cookies'
  test(modelName1, async () => {
    await page.goto(urlModel(modelName1))
    await page.waitForSelector('.block')
    await expect(page).toClick('#btn-flow')
    await page.waitForSelector('.baklava-node')
    await expect(page).toMatchTextContent('Output')
    await page.screenshot({ path: `./tmp/screenshot_flow_${modelName1}.png` })
    await expect(page).toClick('#btn-flow')
    await page.waitForSelector('.block')
    await expect(page).toMatchTextContent('Urn1Cookie')
  })

  const modelName2 = 'test/data_array_mean.json'
  test(modelName2, async () => {
    await page.goto(urlModel(modelName2))
    await page.waitForSelector('.block')
    await expect(page).toClick('#btn-flow')
    await page.waitForSelector('.baklava-node')
    await expect(page).toMatchTextContent('Output')
    await expect(page).toClick('#btn-flow')
    await page.waitForSelector('.block')
    await expect(page).toClick('#btn-run')
    await page.waitForSelector('.result-value')
    await expect(page).toMatchTextContent('3.5')
  })
})

describe('Multiple models', () => {
  const modelName = 'multi_model_output'
  test('Output is preserved when switching', async () => {
    await page.goto(urlModel(`test/${modelName}.json`))
    await page.waitForSelector('#block-id-0-0')
    await expect(page).toClick('#btn-run')
    await page.waitForSelector('.result-value')
    await expect(page).toMatchTextContent('22')
    await expect(page).toClick('button', { text: 'Model2' })
    await page.waitForSelector('#block-id-1-0')
    await waitForText(page, 'E2')
    await waitForNoText(page, '22')
    await expect(page).toClick('#btn-run')
    await waitForText(page, '33')
    await expect(page).toClick('button', { text: 'Model1' })
    await page.waitForSelector('#block-id-0-0')
    await waitForText(page, '22')
  })

  test('Flow is preserved when switching', async () => {
    await page.goto(urlModel(`test/${modelName}.json`))
    await page.waitForSelector('#block-id-0-0')
    await expect(page).toClick('#btn-flow')
    await page.waitForSelector('.baklava-node')
    await expect(page).toClick('button', { text: 'Model2' })
    await waitForText(page, 'E2')
    await expect(page).toClick('#btn-flow')
    await page.waitForSelector('.baklava-node')
    await expect(page).toMatchTextContent('E2')
    await expect(page).toClick('button', { text: 'Model1' })
    await waitForText(page, 'E1')
    await expect(page).toClick('#btn-run')
    await page.waitForSelector('.result-value')
    await expect(page).toMatchTextContent('22')
  })
})