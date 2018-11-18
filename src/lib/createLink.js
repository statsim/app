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
        if (
          // Ignore fields 'type', 'id', 'minimized'
          (['type', 'minimized', 'id'].indexOf(bk) < 0) &&
          // Ignore fields with no values
          !((['units', 'dataType', 'dataCategories'].indexOf(bk) >= 0) && (b[bk] === '')) &&
          // Ignore categories if data is not category
          !((bk === 'dataCategories') && (b.dataType !== 'category'))
        ) {
          sb[getAbbr(bk)] = b[bk]
        }
      })
      sm.b.push(sb)
    })

    shortModels.push(sm)
  })

  return link + query.getQueryString({a: shortModels, preview: isPreview ? '' + (activeModel + 1) : ''})
}
