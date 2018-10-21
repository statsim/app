const Querify = require('./querify.js')
const abbr = require('./abbr.js')
const query = new Querify(['a', 'preview']) // Possible query variables

function getAbbr (key) {
  let a = key // assume we have no abbreviation
  Object.keys(abbr).forEach(k => {
    if (abbr[k] === key) {
      a = k
    }
  })
  return a
}

// Create a shareble link from models
module.exports = function (models, isPreview, activeModel) {
  let link = 'https://statsim.com/app/'
  let shortModels = []
  models.forEach(m => {
    let sm = {
      b: [], // blocks
      mod: {}, // modelParams
      met: {} // methodParams
    }

    // Shortening model params
    Object.keys(m.modelParams).forEach(k => {
      sm.mod[getAbbr(k)] = m.modelParams[k]
    })

    // Method params
    Object.keys(m.methodParams).forEach(k => {
      sm.met[getAbbr(k)] = m.methodParams[k]
    })

    // Blocks
    m.blocks.forEach(b => {
      let sb = {}
      Object.keys(b).forEach(bk => {
        // Ignore descriptional field 'type'
        if (bk !== 'type') {
          sb[getAbbr(bk)] = b[bk]
        }
      })
      sm.b.push(sb)
    })

    shortModels.push(sm)
  })

  return link + query.getQueryString({a: shortModels, preview: isPreview ? '' + (activeModel + 1) : ''})
}
