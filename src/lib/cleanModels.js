const trimData = require('./trimData')

module.exports = function cleanModels (models) {
  const cleanModels = models.map(m => {
    const mod = JSON.parse(JSON.stringify(m))
    if (mod.data) {
      mod.data = trimData(mod.data)
    }
    return mod
  })
  return cleanModels
}
