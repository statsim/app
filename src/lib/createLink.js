const Querify = require('./querify.js')
const abbr = require('./abbr.js')
const query = new Querify(['a', 'preview', 'url']) // Possible query variables

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
module.exports = function (models, activeModel, params) {
  console.log('[Create link] Got params:', params)
  let link = 'https://statsim.com/app/'
  let shortModels = []
  models
    // Throw out dataframes if needed
    .filter(m => (typeof params === 'undefined') || params.includeDataframes || !(m.modelParams.type && (m.modelParams.type === 'dataframe')))
    .forEach(m => {
      let sm = {
        mod: {} // modelParams
        // ,b: [] // blocks
        // ,met: {} // methodParams
      }

      // Shortening model params
      Object.keys(m.modelParams).forEach(k => {
        if (!((k === 'include') && (m.modelParams.include.length === 0))) {
          sm.mod[getAbbr(k)] = m.modelParams[k]
        }
      })

      // Method params
      if (m.modelParams.type && (m.modelParams.type === 'dataframe')) {
        // Dataframe
        if ((typeof params === 'undefined') || (!params.sourcesOnly)) {
          sm.data = m.data
        }
        sm.pipeline = Object.assign({}, m.pipeline)
        delete sm.pipeline.source.stream
        delete sm.pipeline.source.columns
        delete sm.pipeline.processed
        delete sm.pipeline.progress
      } else {
        // Probabilistic model
        sm.met = {}
        Object.keys(m.methodParams).forEach(k => {
          sm.met[getAbbr(k)] = m.methodParams[k]
        })

        // Blocks
        sm.b = []
        m.blocks.forEach(b => {
          let sb = {}
          Object.keys(b).forEach(bk => {
            if (
              // Ignore fields 'type', 'id', 'minimized'
              (['type', 'minimized', 'id', 'pos'].indexOf(bk) < 0) &&
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
      } // *forEach

      shortModels.push(sm)
    })
  let queryObject
  if (
    params.dataUrl &&
    models[activeModel].modelParams.type &&
    models[activeModel].modelParams.type === 'dataframe' &&
    models[activeModel].pipeline.source.url &&
    models[activeModel].pipeline.source.url.length
  ) {
    queryObject = {
      url: models[activeModel].pipeline.source.url,
      preview: params.preview ? '1' : ''
    }
  } else {
    queryObject = {
      a: shortModels,
      preview: params.preview ? '' + (activeModel + 1) : ''
    }
  }
  console.log('[Create link] Base query object:', queryObject)
  return link + query.getQueryString(queryObject)
}
