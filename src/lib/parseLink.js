const Querify = require('./querify')
const abbr = require('./abbr')
const getJSON = require('./getJSON')
const createBaseModel = require('./createBaseModel')

const query = new Querify(['a', 'm', 'preview', 'url'])

const blockTypes = [
  'Random Variable',
  'Expression',
  'Data',
  'Accumulator',
  'Observer',
  'Condition',
  'Neural Net'
]

function getFullKey (key) {
  return (abbr.hasOwnProperty(key)) ? abbr[key] : key
}

module.exports = function (link, cb, err) {
  const q = query.getQueryObject(link) // parsed query object
  console.log('[Link parser] Something interesting here:', q)

  const activeModel = parseInt(q.preview) - 1 || 0
  console.log('[Link parser] Preview value is ', activeModel)

  // Models inside the link
  if (q.a && (typeof q.a === 'object')) { // array is also 'object'
    let models = []
    if (!Array.isArray(q.a)) {
      q.a = [q.a] // check if it was a single model
    }
    q.a.forEach(m => {
      console.log(m)
      // Unzipped model
      let bm = {
        modelParams: {}
      }

      // Getting model params
      Object.keys(m.mod).forEach(k => {
        bm.modelParams[getFullKey(k)] = m.mod[k]
      })

      // Method params
      if (m.met) {
        bm.methodParams = {}
        Object.keys(m.met).forEach(k => {
          bm.methodParams[getFullKey(k)] = m.met[k]
        })
      }

      // Blocks
      if (m.b) {
        bm.blocks = []
        m.b.forEach(b => {
          let block = {}
          block.type = blockTypes[b.t]
          Object.keys(b).forEach(k => {
            if (k === 'p') {
              block.params = Object.assign({}, b.p)
            } else {
              block[getFullKey(k)] = b[k]
            }
          })
          // Check missing params
          if (([0, 1, 2, 3].indexOf(block.typeCode) >= 0) && (!block.units)) {
            block.units = ''
          }
          // Add ID to each block for better list rendering
          // block.id = 'b' + Math.round(Math.random() * 100000000)
          bm.blocks.push(block)
        })
      }

      if (m.pipeline) {
        bm.data = m.data ? m.data : [[null]]
        bm.pipeline = m.pipeline
        bm.pipeline.processed = 0
        bm.pipeline.progress = 0
      }

      // Includes
      // Add include field to each model
      // if (typeof bm.modelParams.include === 'undefined') {
      //  bm.modelParams.include = []
      // }

      models.push(bm)
    })

    console.log('[Link parser] Result models:', models)
    cb({ models, activeModel })

  // Models in the external json file (short)
  } else if (q.m && (typeof q.m === 'string')) {
    getJSON(
      `/examples/${q.m}.json`,
      (models) => {
        if (Array.isArray(models)) {
          cb({ models, activeModel })
        } else {
          // models - object
          let modelsArray = [models]
          cb({ models: modelsArray, activeModel })
        }
      },
      (e) => {
        err(`Loading model error: ${e}`)
      }
    ) // *getJSON
  } else if (q.url && q.url.length) {
    let model = createBaseModel('Data', 'dataframe')
    model.pipeline.source.type = 'url'
    model.pipeline.source.url = q.url
    cb({ models: [model], activeModel: 0})
  }
}
