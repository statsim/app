// Deps
const Dygraphs = require('dygraphs')
const d3 = require('d3-array')
const D3Network = require('vue-d3-network')
const distributions = require('./lib/distributions.js')
const simulationMethods = require('./lib/methods.js')
const Querify = require('./lib/querify.js')
const getJSON = require('./lib/getJSON.js')

const query = new Querify(['s', 'm', 'b', 'p', 'e']) // Possible query variables

// Access global objects
const FileReader = window['FileReader']
const webppl = window['webppl']

const colors = [
  '#fab85a',
  '#0097cc',
  '#84c161',
  '#c44a78',
  '#3a3bb6',
  '#000f64'
]

const icons = [
  '‧ ', '꞉ ', '⁝ ', '꞉꞉', '⁙', '⁝⁝'
]

const icon = icons[Math.floor(Math.random() * 6)]

const blockTypes = [
  'Random Variable',
  'Expression',
  'Data',
  'Accumulator',
  'Observer'
]

const BlockClasses = [
  class RandomVariable {
    constructor (counter) {
      this.distribution = 'Uniform'
      this.name = 'R' + counter
      this.once = false
      this.params = {}
      this.show = true
      this.type = 'Random Variable'
      this.typeCode = 0
    }
  },
  class Expression {
    constructor (counter) {
      this.name = 'E' + counter
      this.history = false
      this.show = true
      this.type = 'Expression'
      this.typeCode = 1
      this.value = ''
    }
  },
  class Data {
    constructor (counter) {
      this.file = null
      this.name = 'D' + counter
      this.show = true
      this.type = 'Data'
      this.typeCode = 2
      this.value = ''
    }
  },
  class Accumulator {
    constructor (counter) {
      this.initialValue = 0
      this.history = false
      this.name = 'A' + counter
      this.show = true
      this.type = 'Accumulator'
      this.typeCode = 3
      this.value = ''
    }
  },
  class Observer {
    constructor (counter) {
      this.distribution = 'Uniform'
      this.params = {}
      this.type = 'Observer'
      this.typeCode = 4
      this.value = ''
    }
  },
  class Condition {
    constructor (counter) {
      this.type = 'Condition'
      this.typeCode = 5
      this.value = ''
    }
  }

]

function createChart (chartTitle, chartData, chartLabels, chartOptions) {
  const chartContainer = document.createElement('div')
  chartContainer.className = 'chart' + ((chartLabels.length > 5) ? ' chart-heavy' : '')
  document.querySelector('.charts').appendChild(chartContainer)
  let options = {
    title: chartTitle,
    labels: chartLabels,
    colors: ['#3f51b5', '#ce3657'],
    strokeWidth: 1,
    strokeBorderWidth: 0
  }
  if (chartLabels.length <= 1100) {
    options.highlightCircleSize = 2
    options.highlightSeriesOpts = {
      strokeBorderWidth: 1,
      highlightCircleSize: 3
    }
  } else {
    options.highlightCircleSize = 0
    options.showLabelsOnHighlight = false
  }
  Object.assign(options, chartOptions)
  const d = new Dygraphs(
    chartContainer,
    chartData,
    options
  )
  console.log('Created chart:', d)
}

function drawScalar (scalar, name) {
  const chartContainer = document.createElement('div')
  chartContainer.className = 'chart'
  chartContainer.innerHTML = `
    <h1>${+scalar.toFixed(6)}</h1>
    <p>${name}</p>
  `
  document.querySelector('.charts').appendChild(chartContainer)
}

function drawVector (vector, name) {
  console.log('drawVector()')
  createChart(
    name,
    vector.map((v, i) => [i, v]),
    ['Step', name]
  )
}

function drawVectors (vectors, names) {
  createChart(
    (names.length > 5) ? 'Join' : names.join(', '),
    vectors[0].map((_, i) => [i].concat(vectors.map(vector => vector[i]))),
    ['Step'].concat(names)
  )
  console.log('drawVectors()')
}

const params = {
  components: {
    D3Network
  },
  data: () => ({
    icon,
    graphOptions:
    {
      force: 5000,
      nodeSize: 20,
      fontSize: 15,
      nodeLabels: true,
      linkWidth: 2
    },
    link: '',
    loading: false, // show loading indicator
    error: '',
    variableCounter: 0,
    steps: 1,
    distributions,
    code: '', // compiled webppl code
    blocks: [],
    simulationMethods,
    method: 'MCMC',
    methodParams: {
      samples: 1000
    }
  }),
  computed: {
    graphNodes: function () {
      return this.blocks.map((b, i) => ({
        id: i,
        name: (b.name && b.name.length) ? `${b.name} (${b.type})` : b.type,
        _color: colors[b.typeCode]
      }))
    },
    graphLinks: function () {
      const check = (str, baseBlockIndex) => {
        const l = []
        if (typeof str === 'string') {
          this.blocks.forEach((b, i) => {
            if (b.name && (str.split(/[^A-Za-z0-9]/g).indexOf(b.name) >= 0)) {
              l.push({
                tid: baseBlockIndex,
                sid: i,
                _color: '#DDD'
              })
            }
          })
        }
        return l
      }
      let links = []
      this.blocks.forEach((b, i) => {
        switch (b.typeCode) {
          case 0: // RV
            Object.keys(distributions[b.distribution]).forEach(k => {
              links = links.concat(check(b.params[k], i))
            })
            break
          case 1: // Expression
            links = links.concat(check(b.value, i))
            break
          case 3: // Accum
            links = links.concat(check(b.value, i))
            links = links.concat(check(b.initialValue, i))
            break
          case 4: // Observer
            Object.keys(distributions[b.distribution]).forEach(k => {
              links = links.concat(check(b.params[k], i))
            })
            links = links.concat(check(b.value, i))
            break
          case 5:
            links = links.concat(check(b.value, i))
            break
        }
      })
      return links
    }
  },
  mounted () {
    const app = this
    const kMap = {
      d: 'distribution',
      f: 'file',
      h: 'history',
      i: 'initialValue',
      t: 'typeCode',
      n: 'name',
      o: 'once',
      p: 'params',
      s: 'show',
      v: 'value'
    }
    const pMap = {
      s: 'samples',
      l: 'lag',
      b: 'burn',
      o: 'onlyMAP'
    }
    if (window.location.search) {
      var queryObj = query.getQueryObject(window.location.search)
      setTimeout(() => {
        console.log('Got input params', queryObj)
        // Read blocks
        if (queryObj.b && Array.isArray(queryObj.b)) {
          queryObj.b.forEach(b => {
            const newb = {}
            Object.keys(b).forEach(k => {
              if (k === 'o' || k === 's' || k === 'h') {
                b[k] = b[k] === 1
              }
              newb[kMap[k]] = ((k !== 't') && (typeof b[k] === 'number')) ? b[k] + '' : b[k]
            })
            newb.type = blockTypes[b.t]
            console.log(newb.type)
            app.blocks.push(newb)
          })
        }
        // Read method params
        if (queryObj.p && (typeof queryObj.p === 'object')) {
          Object.keys(queryObj.p).forEach(paramKey => {
            // Get fullkey if exist
            const fullKey = (pMap[paramKey] && pMap[paramKey].length > 0) ? pMap[paramKey] : paramKey
            app.methodParams[fullKey] = queryObj.p[paramKey]
          })
        }
        if (queryObj.s) {
          app.steps = +queryObj.s
        }
        if (queryObj.e) {
          app.method = queryObj.e
        }
        if (queryObj.m) {
          getJSON(
            `/models/${queryObj.m}.json`,
            (d) => {
              console.log('Readed data:', d)
              Object.assign(app, d)
            },
            (e) => {
              app.error = `Loading model error: ${e}`
            }
          )
        }
      }, 300)
    }
  },
  methods: {
    blockFilter (list, query) {
      const arr = []
      for (let i = 0; i < list.length; i++) {
        if (list[i].name.indexOf(query) !== -1) {
          arr.push(list[i])
        }
        if (arr.length > 5) {
          break
        }
      }
      return arr
    },
    toggleRightSidenav () {
      this.$refs.rightSidenav.toggle()
    },
    closeRightSidenav () {
      this.$refs.rightSidenav.close()
    },
    generateWebPPL () {
      this.loading = true
      setTimeout(() => {
        this.loading = false
        this.compile()
        this.link = this.code
      }, 500)
    },
    generateLink () {
      const bl = this.blocks.map(b => {
        const o = {}
        Object.keys(b).forEach(k => {
          // TODO: Possible error if multiple keys start with the same char
          if (k !== 'type') {
            o[k[0]] = (typeof b[k] === 'boolean') ? +b[k] : b[k]
          }
        })
        return o
      })
      this.link = 'https://statsim.com/app/' + query.getQueryString({
        s: this.steps,
        e: this.method,
        b: bl,
        p: this.methodParams
      })
    },
    generateJSON () {
      this.link = JSON.stringify({
        blocks: this.blocks,
        steps: this.steps,
        method: this.method,
        methodParams: this.methodParams
      }, null, 2) // indent with 2 spaces
    },
    lcb (link) {
      link._svgAttrs = { 'marker-end': 'url(#m-end)' }
      return link
    },
    ncb (e, node) {
      const block = document.getElementById('block-id-' + node.index)
      const offset = block.offsetTop
      document.getElementById('side-bar').scrollTop = offset - 20
    },
    loadFiles (files, blockIndex) {
      const reader = new FileReader()
      reader.readAsText(files[0])
      reader.onload = () => {
        const dataText = reader.result
        this.blocks[blockIndex].value = dataText
      }
    },
    addBlock (blockClassNumber) {
      this.variableCounter++
      this.blocks.push(new BlockClasses[blockClassNumber](this.variableCounter))
    },
    moveBlockToTop (blockIndex) {
      if (blockIndex > 0) {
        this.blocks.splice(0, 0, this.blocks.splice(blockIndex, 1)[0])
      }
    },
    moveBlockUp (blockIndex) {
      if (blockIndex > 0) {
        this.blocks.splice(blockIndex - 1, 0, this.blocks.splice(blockIndex, 1)[0])
      }
    },
    moveBlockDown (blockIndex) {
      if (blockIndex < this.blocks.length - 1) {
        this.blocks.splice(blockIndex + 1, 0, this.blocks.splice(blockIndex, 1)[0])
      }
    },
    removeBlock (blockIndex) {
      this.blocks.splice(blockIndex, 1)
    },
    compile () {
      let c = ''

      // Model generation
      let model = 'var model = function () {\n'
      let step = {
        body: '',
        list: '_i',
        accum: '_i: _i + 1',
        initial: '_i: 1'
      }
      let modelOutput = ''
      let observers = ''

      this.blocks.forEach(b => {
        if (b.typeCode === 0) {
          // --> Random variable
          let params = ''
          let distParams = Object.keys(distributions[b.distribution])
          distParams.forEach((key, i) => {
            if (b.params.hasOwnProperty(key)) {
              params += `${key}: ${b.params[key]}${(i < distParams.length - 1) ? ', ' : ''}`
            }
          })
          // Check if we are inside the loop
          if ((this.steps > 1.5) && (!b.once)) {
            step.body += `var ${b.name} = sample(${b.distribution}({${params}}))\n`
          } else {
            model += `var ${b.name} = sample(${b.distribution}({${params}}))\n`
          }
        } else if (b.typeCode === 1) {
          // --> Expression
          // Check if we are inside the loop
          if (this.steps > 1.5) {
            // Generate a list of accumulators
            step.list += (step.list.length) ? ', ' : ''
            step.list += b.name + ((b.history) ? ', ' + b.name + '_hist' : '')
            // Caclulate expression in the body
            step.body += `var _${b.name} = ${b.value}\n`
            // Generate accumulator expressions
            step.accum += (step.accum.length ? ',\n' : '') + `${b.name}: _${b.name}`
            step.accum += (b.history) ? `,\n${b.name}_hist: ${b.name}_hist.concat(_${b.name})` : ''
            // Generate initial values
            step.initial += (step.initial.length ? ',\n' : '') + `${b.name}: 0`
            step.initial += (b.history) ? `,\n${b.name}_hist: [0]` : ''
          } else {
            model += `var ${b.name} = ${b.value}\n`
          }
        } else if (b.typeCode === 2) {
          // --> Data
          model = (b.value.indexOf(',') >= 0)
            ? `var ${b.name} = [${b.value}]\n` + model
            : `var ${b.name} = ${b.value}\n` + model
        } else if (b.typeCode === 3) {
          // --> Accumulator
          // Check if we are inside the loop
          if (this.steps > 1.5) {
            // Generate a list of accumulators
            step.list += (step.list.length) ? ', ' : ''
            step.list += b.name + ((b.history) ? ', ' + b.name + '_hist' : '')
            // Accumulate value in the step body
            step.body += `var _${b.name} = ${b.name} + ${b.value}\n`
            // Generate accumulator expressions
            step.accum += (step.accum.length ? ',\n' : '') + `${b.name}: _${b.name}`
            step.accum += (b.history) ? `,\n${b.name}_hist: ${b.name}_hist.concat(_${b.name})` : ''
            // Generate initial values
            step.initial += (step.initial.length ? ',\n' : '') + `${b.name}: ${b.initialValue}`
            step.initial += (b.history) ? `,\n${b.name}_hist: [${b.initialValue}]` : ''
          } else {
            model += `var ${b.name} = ${b.initialValue} + ${b.value}\n`
          }
        } else if (b.typeCode === 4) {
          // --> Observer
          const findDataVectors = str => {
            const dataVectors = []
            this.blocks.forEach(b => {
              if ((b.typeCode === 2) && b.value.indexOf(',') && (str.indexOf(b.name) >= 0)) {
                dataVectors.push(b.name)
              }
            })
            console.log('String: ', str, dataVectors)
            return dataVectors
          }
          const distParams = Object.keys(distributions[b.distribution])
          let vectors = []
          let params = ''
          let observer = ''
          // Check distribution parameters
          distParams.forEach((key, i) => {
            if (b.params.hasOwnProperty(key)) {
              vectors = vectors.concat(findDataVectors(b.params[key]))
              params += `${key}: ${b.params[key]}${(i < distParams.length - 1) ? ', ' : ''}`
            }
          })
          // Check observed value
          vectors = vectors.concat(findDataVectors(b.value))
          // Generate observer
          observer += (vectors.length > 0)
            ? (vectors.length === 1) ? `map(function (${vectors[0]}) {\n` : `map(function (${vectors.join(',')}) {\n`
            : ''
          observer += `observe(${b.distribution}({${params}}), ${b.value})\n`
          observer += (vectors.length > 0)
            ? `}, ${vectors.join(',')})\n`
            : '\n'
          if (this.steps > 1.5) {
            observers += observer
          } else {
            model += observer
          }
        } else if (b.typeCode === 5) {
          // --> Condition
          const cond = `condition(${b.value})\n`
          if (this.steps > 1.5) {
            observers += cond
          } else {
            model += cond
          }
        }
        if (
          b.name && b.show && (
            // Multi step simulation - output only what we can
            ((this.steps > 1.5) && (((b.typeCode === 0) && b.once) || (b.typeCode === 1) || (b.typeCode === 2) || (b.typeCode === 3))) ||
            // One step - output all we want
            (this.steps < 1.5)
          )
        ) { // Return variables
          modelOutput += b.name + ', ' + ((b.history && this.steps > 1.5) ? b.name + '_hist, ' : '')
        }
      })
      // Generate steps
      if (this.steps > 1.5) {
        model += `
var step = function (n) {
if (n > 0) {
var {${step.list}} = step(n - 1)
${step.body}
return {
${step.accum}
}
} else {
return {
${step.initial}
}
}
}
var {${step.list}} = step(${Math.round(this.steps)})
`
        model += observers
      }
      // Remove last comma from return object
      if (modelOutput.length > 0) {
        modelOutput = modelOutput.slice(0, -2)
        model += `return {${modelOutput}}\n`
      }
      model += '}\n'
      c += model

      // Inference
      let inf = ''
      if (this.method === 'deterministic') {
        inf = `model()\n`
      } else {
        let paramStr = ''
        let kernelStr = ''
        let kernelParamStr = ''
        let realMethod = this.method
        Object.keys(this.methodParams).forEach(key => {
          if (key === 'steps' || key === 'stepSize') {
            kernelParamStr += (kernelParamStr.length) ? ', ' : ''
            kernelParamStr += `${key}: ${this.methodParams[key]}`
          } else {
            paramStr += `, ${key}: ${this.methodParams[key]}`
          }
        })
        if (this.method === 'HMC') {
          realMethod = 'MCMC'
          kernelStr = (kernelParamStr.length) ? `, kernel: {HMC: {${kernelParamStr}}}` : `, kernel: 'HMC'`
        }
        inf = `Infer({model, method: '${realMethod}'${kernelStr + paramStr}})\n`
      }
      c += inf

      this.code = c
    },
    run () {
      this.loading = true
      this.link = ''
      document.getElementById('loader').className = ''
      this.icon = icons[Math.floor(Math.random() * 6)]
      this.error = ''
      this.compile()
      // Add some delay to finish display update
      setTimeout(() => {
        try {
          webppl.run(this.code, (s, v) => {
            document.getElementById('loader').className = 'hidden'
            this.loading = false
            document.querySelector('.charts').innerHTML = ''
            if (this.method === 'deterministic') {
              // deterministic
              let vectors = []
              let names = []
              Object.keys(v).forEach(key => {
                const value = v[key]
                if (Array.isArray(value)) {
                  // Vector
                  vectors.push(value)
                  names.push(key)
                  drawVector(value, key)
                } else {
                  // Scalar value
                  drawScalar(value, key)
                }
              }) // *Object.keys
              // All lines on one chart
              if (names.length > 1) {
                drawVectors(vectors, names)
              }
            } else {
              // Stochastic viz
              console.log('WebPPL output: ', v)
              // Collect samples in a useful object:
              // { variable_name: [sample_1, sample_2, ...] }
              const samples = {}
              // Detect repeating samples
              const repeatingSamples = {}
              v.samples.forEach(s => {
                Object.keys(s.value).forEach(k => {
                  const sampleValue = s.value[k]
                  if (!samples.hasOwnProperty(k)) {
                    samples[k] = []
                    repeatingSamples[k] = true
                  }
                  if ((samples[k].length) && (JSON.stringify(sampleValue) !== JSON.stringify(samples[k][0]))) {
                    repeatingSamples[k] = false
                  }
                  samples[k].push(s.value[k])
                })
              })
              console.log('Repeating samples: ', repeatingSamples)
              Object.keys(samples).forEach(k => {
                if (Array.isArray(samples[k][0])) {
                  // Array sample
                  if (repeatingSamples[k]) {
                    // -- All samples are same
                    drawVector(samples[k][0], k)
                  } else {
                    // -- Random array samples
                    const data = []
                    const labels = ['Step']
                    samples[k].forEach((s, si) => {
                      labels.push(k + ` (v${si})`)
                      s.forEach((sv, i) => {
                        if (!data[i]) data[i] = [i]
                        data[i].push(sv)
                      })
                    })
                    createChart(`${k} ${this.samples} Samples`, data, labels)
                    createChart(
                      k + ' Average',
                      data.map(
                        d => [d[0], [d3.min(d.slice(1)), d3.mean(d.slice(1)), d3.max(d.slice(1))]]
                      ),
                      ['Step', k],
                      {
                        customBars: true
                      }
                    )
                  } // -- *random array samples
                } else {
                  if (repeatingSamples[k]) {
                    // -- Draw scalar value
                    drawScalar(samples[k][0], k)
                  } else {
                    // -- Draw random variable
                    createChart(k + ' Trace', samples[k].map((s, si) => [si, s]), ['Sample', k])
                    // ---- Distribution
                    const unique = Array.from(new Set(samples[k])).length
                    const t = (unique <= 30) ? unique : 30
                    const hist = d3.histogram().thresholds(t)
                    const h = hist(samples[k])
                    createChart(
                      k + ' Distribution',
                      h.map(v => [v.x0, v.length / samples[k].length]),
                      ['Sample', k],
                      {
                        stepPlot: true,
                        fillGraph: true
                      }
                    )
                    // ---- CDF
                    const sMin = d3.min(samples[k])
                    const sMax = d3.max(samples[k])
                    if (sMin < sMax) {
                      const sStep = (sMax - sMin) / 200
                      const cdf = []
                      for (let i = sMin; i <= sMax; i += sStep) {
                        cdf.push([i, samples[k].filter(s => s < i).length / samples[k].length])
                      }
                      createChart(k + ' CDF', cdf, [k, 'p'])
                    }
                  } // -- *draw random variable
                }
              })
            } // *stochastic visualization
          }) // *webppl.run()
        } catch (err) {
          this.loading = false
          document.getElementById('loader').className = 'hidden'
          console.log(err)
          this.error = err.message
        }
      }, 500)
    }
  }
}

module.exports = params
