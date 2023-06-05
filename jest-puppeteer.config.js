module.exports = {
  launch: {
    dumpio: false, // dump browser errors to jest
    headless: process.env.HEADLESS !== 'false' ? "new" : false,
    product: 'chrome',
  },
  browserContext: 'default',
}
