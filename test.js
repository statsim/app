const test = require('tape')
const puppeteer = require('puppeteer')
const server = 'http://localhost:8085/'

;(async () => {
  const browser = await puppeteer.launch()
  test('Pi test', async (_) => {
    const config = `?a=%5B%7B%22b%22%3A%5B%7B%22d%22%3A%22Uniform%22%2C%22n%22%3A%22X%22%2C%22o%22%3Afalse%2C%22p%22%3A%7B%22a%22%3A%22-1%22%2C%22b%22%3A%221%22%7D%2C%22sh%22%3Atrue%2C%22t%22%3A0%7D%2C%7B%22d%22%3A%22Uniform%22%2C%22n%22%3A%22Y%22%2C%22o%22%3Afalse%2C%22p%22%3A%7B%22a%22%3A%22-1%22%2C%22b%22%3A%221%22%7D%2C%22sh%22%3Atrue%2C%22t%22%3A0%7D%2C%7B%22i%22%3A0%2C%22h%22%3Afalse%2C%22n%22%3A%22Sa%22%2C%22sh%22%3Afalse%2C%22t%22%3A3%2C%22v%22%3A%22%28%28X%20%2A%20X%20%2B%20Y%20%2A%20Y%20%3C%201%29%20%3F%201%20%3A%200%29%22%7D%2C%7B%22n%22%3A%22Pi%22%2C%22h%22%3Afalse%2C%22sh%22%3Atrue%2C%22t%22%3A1%2C%22v%22%3A%22Sa%20%2A%204%20%2F%20_i%22%7D%5D%2C%22mod%22%3A%7B%22n%22%3A%22Pi%22%2C%22s%22%3A%22200000%22%2C%22m%22%3A%22deterministic%22%7D%2C%22met%22%3A%7B%22sm%22%3A1000%7D%7D%5D`
    const page = await browser.newPage()
    await page.goto(server + config)
    await page.waitForSelector('.block') // Wait for blocks to load
    await page.click('.run-button')
    await page.waitForSelector('.result-value') // Wait for resulting charts to load
    const value = await page.$eval('.result-value', node => node.innerText)
    _.true(value - Math.PI < 0.1)
    _.end()
  })
  test.onFinish(async (_) => {
    await browser.close()
  })
})()
