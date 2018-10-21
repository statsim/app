const Querify = require('./querify')
const abbr = require('./abbr')
const getJSON = require('./getJSON')
const query = new Querify(['a', 'm', 'preview'])

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
  console.log('Got query:', q)
  const activeModel = parseInt(q.preview) - 1 || 0
  console.log(activeModel)
  // Models inside the link
  if (q.a && (typeof q.a === 'object')) { // array is also 'object'
    let models = []
    if (!Array.isArray(q.a)) {
      q.a = [q.a] // check if it was a single model
    }
    q.a.forEach(m => {
      // Unzipped model
      let bm = {
        modelParams: {},
        methodParams: {},
        blocks: []
      }

      // Getting model params
      Object.keys(m.mod).forEach(k => {
        bm.modelParams[getFullKey(k)] = m.mod[k]
      })

      // Method params
      Object.keys(m.met).forEach(k => {
        bm.methodParams[getFullKey(k)] = m.met[k]
      })

      // Blocks
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
        bm.blocks.push(block)
      })

      models.push(bm)
    })
    cb({ models, activeModel })

  // Models in the external json file (short)
  } else if (q.m && (typeof q.m === 'string')) {
    getJSON(
      `/models/${q.m}.json`,
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
  }
}
