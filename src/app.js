// Deps
const Dygraphs = require('dygraphs')
const d3 = require('d3-array')
const D3Network = require('vue-d3-network')
const hist2d = require('d3-hist2d').hist2d
const parseCSV = require('csv-parse')
const fileSaver = require('file-saver')
const cookie = require('cookie')
const Stats = require('online-stats')

const distributions = require('./lib/distributions')
const simulationMethods = require('./lib/methods')
const compileModels = require('./lib/compileModels')
const createLink = require('./lib/createLink')
const parseLink = require('./lib/parseLink')
const graphIcons = require('./lib/graphIcons')

// const Querify = require('./lib/querify')
// const getJSON = require('./lib/getJSON')
// const query = new Querify(['m', 'a']) // Possible query variables

// Access global objects
const FileReader = window['FileReader']
const Blob = window['Blob']
const webppl = window['webppl']
const fetch = window['fetch']
const plot2d = window['densityPlot'] // ESM WTF!!!

const baseModel = [
  {
    modelParams:
    {
      name: 'Main',
      description: '',
      steps: 1,
      method: 'MCMC'
    },
    blocks: [],
    methodParams:
    {
      samples: 1000
    }
  }
]

const colors = [
  '#eaac0c',
  '#0097cc',
  '#61c900',
  '#d51558',
  '#ababab',
  '#ababab',
  '#ababab'
]

const sizes = [
  20,
  25,
  15,
  30,
  25,
  25
]

const icons = [
  '‧ ', '꞉ ', '⁝ ', '꞉꞉', '⁙', '⁝⁝'
]

const icon = icons[Math.floor(Math.random() * 6)]

const BlockClasses = [
  class RandomVariable {
    constructor (counter) {
      this.distribution = 'Uniform'
      this.name = 'R' + counter
      this.once = false
      this.params = {}
      this.show = false
      this.type = 'Random Variable'
      this.typeCode = 0
      this.dims = '1'
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
    constructor (counter, data) {
      this.name = (typeof counter === 'string') ? counter : 'D' + counter
      this.show = false
      this.type = 'Data'
      this.typeCode = 2
      this.useAsParameter = false // Name is a parameter for the model when called externally
      this.dims = '' // Tensor dimensions
      if (data && Array.isArray(data)) {
        this.value = data.join()
      } else if (data && (typeof data === 'string')) {
        this.value = data
      } else {
        this.value = ''
      }
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
      this.min = ''
      this.max = ''
    }
  },
  class Observer {
    constructor (counter) {
      this.distribution = 'Gaussian'
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
  console.log('Dygraph chart:', typeof d)
}

function drawScalar (scalar, name) {
  const chartContainer = document.createElement('div')
  chartContainer.className = 'chart'
  chartContainer.innerHTML = `
    <h1>${(!isNaN(parseFloat(scalar)) && isFinite(scalar)) ? +scalar.toFixed(6) : scalar}</h1>
    <p>${name}</p>
  `
  document.querySelector('.charts').appendChild(chartContainer)
}

function drawObject (obj, name) {
  const chartContainer = document.createElement('div')
  chartContainer.className = 'chart'
  let cont = `<div class="summary"><h3>${name}</h3><table>`
  Object.keys(obj).forEach(key => {
    const val = obj[key]
    cont += `<tr><td><b>${key}<b></td>`
    if (Array.isArray(val)) {
      cont += `<td>${val.toString().slice(0, 30)}</td></tr>`
    } else {
      cont += `<td>${(val % 1 === 0) ? val : val.toFixed(6)}</td></tr>`
    }
  })
  cont += `</table></div>`
  chartContainer.innerHTML = cont
  document.querySelector('.charts').appendChild(chartContainer)
}

function drawVector (vector, name) {
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
}

function delay (time, cb) {
  this.loading = true
  setTimeout(() => {
    this.loading = false
    cb()
  }, time)
}

const params = {
  components: {
    D3Network
  },
  data: () => ({
    icon,
    colors,
    theme: 'light',
    graphOptions:
    {
      force: 5000,
      nodeSize: 35,
      fontSize: 14,
      nodeLabels: true,
      linkWidth: 2.3
    },
    link: '',
    loading: false, // show loading indicator
    message: '',
    error: '',
    server: false,
    serverURL: '',
    serverAPI: '',
    // distributions,
    code: '', // compiled webppl code
    simulationMethods,
    /*
      SWITCHING BETWEEN MODELS
      In JS when you assign (o1 = o2) arrays or objects you actually just create a link
      So changing o1 keys automatically changes o2
      We'll use that feature to switch
      There're active model param objects: modelParams, methodParams, blocks
      But they always link to one of the models objects
    */
    activeModel: 0,
    models: [],
    blocks: [], // actually link to the 'blocks' array of one of the models[] object
    modelParams: {}, // link
    methodParams: {} // link
  }),
  computed: {
    // Calculated list of distributions
    // Based on predefined distributions from lib/distributions.js
    // Also new user-defined models added
    distributions () {
      const newDistrs = {}
      // Iterate over all models
      this.models.forEach(m => {
        const distr = {}
        // Collect all data fields with useAsParameter attributes
        m.blocks.filter(b => ((b.typeCode === 2) && (b.useAsParameter))).forEach(b => {
          distr[b.name] = {
            type: 'any'
          }
        })
        newDistrs[m.modelParams.name] = distr
      })
      const finDistrs = Object.assign({}, newDistrs, distributions)
      return finDistrs
    },
    graphNodes: function () {
      console.log('Active: ', this.activeModel)
      return this.blocks
        .map((b, i) => ({
          id: i,
          name: (b.name && b.name.length) ? `${b.name}` : b.type,
          _color: colors[b.typeCode],
          _size: sizes[b.typeCode],
          svgSym: graphIcons[b.typeCode]
        }))
        .concat(this.models.filter((_, i) => i !== this.activeModel).map((m, i) => ({
          id: this.blocks.lenght + i,
          name: m.modelParams.name,
          _color: '#FFF',
          _size: 35
        })))
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
                _color: (this.theme === 'dark') ? '#444' : '#DDD'
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
            // Load selected distribution / model
            const distr = this.distributions[b.distribution]
            if (distr) {
              // Iterate over its keys
              Object.keys(distr).forEach(k => {
                // Check params=keys of the block
                // Add result to links array
                links = links.concat(check(b.params[k], i))
              })
            }
            break
          case 1: // Expression
            links = links.concat(check(b.value, i))
            break
          case 3: // Accum
            links = links.concat(check(b.value, i))
            links = links.concat(check(b.initialValue, i))
            break
          case 4: // Observer
            Object.keys(this.distributions[b.distribution]).forEach(k => {
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
  created () {
    // Before mounting
    // Initialize main model
    this.models = JSON.parse(JSON.stringify(baseModel))
    this.switchModel(0)
    // Check theme
    this.theme = (document.cookie.indexOf('dark') > 0) ? 'dark' : 'light'
    const c = cookie.parse(document.cookie)
    this.server = (c.server === 'true')
    this.serverURL = c.url ? c.url : ''
    this.serverAPI = c.api ? c.api : ''
  },
  mounted () {
    // After mounting
    // Check if window.location contain any param
    // m: short name for example model saved in JSON format
    // a: array of models embedded in the link
    if (window.location.search) {
      parseLink(
        window.location.search,
        (models) => {
          setTimeout(() => {
            this.models = models
            this.switchModel(0)
          }, 200)
        },
        (err) => {
          this.error = err
        }
      )
    } // *if window.location.search is not empty
  },
  methods: {
    addExpression (str, i, sh) {
      const shift = (typeof sh === 'undefined') ? 0 : sh
      const input = document.querySelector(`#input-${i}`)
      const pos = input.selectionStart
      const value = this.blocks[i].value
      this.blocks[i].value = value.slice(0, pos) + str + value.slice(pos)
      const newPos = pos + str.length + shift
      setTimeout(() => {
        input.focus()
        input.setSelectionRange(newPos, newPos)
      }, 100)
    },
    setTheme (theme) {
      this.theme = theme
      document.cookie = 'theme=' + theme
    },
    newProject () {
      delay.call(this, 500, () => {
        window.history.replaceState({}, 'New project', '.')
        // Clean models
        this.models = JSON.parse(JSON.stringify(baseModel))
        // Switch to base model
        this.switchModel(0)
      })
    },
    openFile (fileType) {
      document.getElementById(`open${fileType}File`).click()
    },
    openDataFile (e) {
      const reader = new FileReader()
      const file = e.target.files[0]
      reader.readAsText(file)
      reader.onload = () => {
        const data = reader.result
        parseCSV(data, {}, (err, output) => {
          if (!err) {
            if (output.length > 1) {
              // CSV
              output[0].forEach((h, hi) => {
                this.blocks.push(new BlockClasses[2](
                  h,
                  // Filter out the first line
                  output.filter((_, i) => i > 0).map(v => v[hi])
                ))
              })
            } else {
              // Comma-separated line
              this.blocks.push(new BlockClasses[2](file.name.split('.')[0], output))
            }
          } else {
            console.log(err)
          }
        })
      }
    },
    openProjectFile (e) {
      const reader = new FileReader()
      const file = e.target.files[0]
      reader.readAsText(file)
      reader.onload = () => {
        const models = JSON.parse(reader.result)
        delay.call(this, 500, () => {
          window.history.replaceState({}, 'New project', '.')
          this.models = Array.isArray(models) ? models : [models]
          this.switchModel(0)
        })
      }
    },
    saveProject () {
      const blob = new Blob([JSON.stringify(this.models, null, 2)], {type: 'text/plain;charset=utf-8'})
      fileSaver.saveAs(blob, this.models[0].modelParams.name + '.json')
    },
    // Open remove model dialog
    openDialog (ref) {
      this.$refs[ref].open()
    },
    createModel () {
      const m = {
        modelParams: {
          name: 'Model' + this.models.length,
          description: '',
          method: 'deterministic',
          steps: 1
        },
        methodParams: {
          samples: 1000
        },
        blocks: []
      }
      this.models.push(m)
      this.switchModel(this.models.length - 1)
    },
    switchModel (modelId) {
      const m = this.models[modelId]
      this.link = '' // clean code
      this.error = ''
      this.message = ''
      const chartContainer = document.querySelector('.charts')
      if (chartContainer) {
        chartContainer.innerHTML = ''
        document.querySelector('.charts-2d').innerHTML = ''
      }
      this.activeModel = modelId
      this.blocks = m.blocks
      this.modelParams = m.modelParams
      this.methodParams = m.methodParams
    },
    duplicateModel () {
      let newModel = JSON.parse(JSON.stringify(this.models[this.activeModel]))
      newModel.modelParams.name += 'Copy'
      this.models.push(newModel)
    },
    removeModel (confirm) {
      if (confirm === 'ok') {
        this.models.splice(this.activeModel, 1)
        this.switchModel(this.models.length - 1)
      }
    },
    // Callback for autocomplete element
    // Filter the blocks list to match query string (using a block's name)
    // Returns filtered array of blocks
    blockFilter (list, query) {
      const arr = []
      for (let i = 0; i < list.length; i++) {
        if (list[i].hasOwnProperty('name') && (list[i].name.indexOf(query) !== -1)) {
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
      delay.call(this, 1000, () => {
        this.compile()
        this.link = this.code
      })
    },
    generateLink () {
      delay.call(this, 400, () => {
        this.link = createLink(this.models)
      })
    },
    generateJSON () {
      delay.call(this, 600, () => {
        this.link = JSON.stringify(this.models, null, 2) // indent with 2 spaces
      })
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
    addBlock (blockClassNumber) {
      this.blocks.push(new BlockClasses[blockClassNumber](this.blocks.length))
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
      // Convert available models (this.models) to the probabilistic lang
      this.code = compileModels(this.models, this.activeModel)
    },
    processResults (v) {
      document.getElementById('loader').className = 'hidden'
      this.loading = false
      this.message = 'Done!'
      if (this.modelParams.method === 'deterministic') {
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
        this.message += (v.samples) ? ` Generated ${v.samples.length} samples` : ''
        // Collect samples in a useful object:
        // { variable_name: [sample_1, sample_2, ...] }
        const samples = {}
        // Maximum a posteriori
        let map
        let mapScore = Number.NEGATIVE_INFINITY
        // Collect random variables in rvs array to draw 2d plot later
        const rvs = []
        // Detect repeating samples
        const repeatingSamples = {}
        v.samples.forEach((s, si) => {
          // Check sample score. Max score shows map estimate
          if (s.hasOwnProperty('score') && (s.score > mapScore)) {
            map = s.value
            mapScore = s.score
          }
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
        // Show MAP estimates
        console.log('MAP:', map, mapScore)
        drawObject(map, 'MAP estimates')

        Object.keys(samples).forEach(k => {
          if (typeof samples[k][0] === 'boolean') {
            // Boolean samples
            const countTrue = samples[k].reduce((acc, val) => (val ? acc + 1 : acc), 0)
            const countFalse = samples[k].length - countTrue
            createChart(
              `${k} Truth/False rate`,
              [[1, countTrue, countFalse]],
              ['', 'True', 'False'],
              {
                drawPoints: true,
                pointSize: 10
              }
            )
          } else if (Array.isArray(samples[k][0])) {
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
              createChart(`${k} ${this.methodParams.samples} Samples`, data, labels)
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
              rvs.push(k)
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
              // ---- Statistics
              const stats = Stats.Series(Stats.Mean(), Stats.Variance({ddof: 1}), Stats.Std(), Stats.Median(), Stats.Min(), Stats.Max())
              samples[k].forEach(s => stats(s))
              drawObject(stats.values, k + ' summary')
            } // -- *draw random variable
          } // *scalars samples
        }) // *iterate over all sample keys (k)
        // Draw 2d plot
        if (rvs.length >= 2) {
          document.querySelector('.charts-2d').innerHTML = ''
          for (let r1 = 0; r1 < rvs.length - 1; r1++) {
            for (let r2 = r1 + 1; r2 < rvs.length; r2++) {
              const samples2d = samples[rvs[r1]].map((v, i) => [v, samples[rvs[r2]][i]])
              const r1min = d3.min(samples[rvs[r1]])
              const r1max = d3.max(samples[rvs[r1]])
              const r2min = d3.min(samples[rvs[r2]])
              const r2max = d3.max(samples[rvs[r2]])
              hist2d().bins(100).domain([[r1min, r1max], [r2min, r2max]])(
                samples2d,
                h => {
                  const plotData = []
                  for (let i = 0; i < 100; i++) {
                    if (!Array.isArray(plotData[i])) {
                      plotData[i] = []
                    }
                    for (let j = 0; j < 100; j++) {
                      plotData[i][j] = 0
                    }
                  }

                  h.forEach(bin => { plotData[bin.x][bin.y] = bin.length })
                  const chartContainer = document.createElement('div')
                  chartContainer.className = 'chart-2d'
                  chartContainer.innerHTML = `<p>${rvs[r1]},${rvs[r2]}</p>`
                  const chartCanvasContainer = document.createElement('div')
                  chartContainer.appendChild(chartCanvasContainer)
                  document.querySelector('.charts-2d').appendChild(chartContainer)
                  plot2d(plotData, {
                    simple: true,
                    target: chartCanvasContainer,
                    noXAxes: true,
                    noYAxes: true,
                    noLegend: true,
                    width: 300,
                    height: 300,
                    color: 'Blues'
                  })
                }
              )
            }// *for
          }// *for
        }
      } // *stochastic visualization
    },
    run () {
      const errorHandler = (err) => {
        this.loading = false
        document.getElementById('loader').className = 'hidden'
        console.log(err)
        this.error = err.message
      }

      document.querySelector('.charts').innerHTML = ''
      document.querySelector('.charts-2d').innerHTML = ''
      document.querySelector('.charts-extra').innerHTML = ''

      this.loading = true
      this.link = ''
      document.getElementById('loader').className = ''
      this.icon = icons[Math.floor(Math.random() * 6)]
      this.message = ''
      this.error = ''
      this.compile()
      document.cookie = 'url=' + this.serverURL
      document.cookie = 'api=' + this.serverAPI
      document.cookie = 'server=' + this.server

      // Add some delay to finish display update
      setTimeout(() => {
        try {
          // Precheck models
          if (!this.blocks.length) {
            throw new Error('Empty model! Click ADD BLOCK to start designing the model!')
          }
          if (!this.blocks.reduce((acc, b) => acc || b.show, false)) {
            throw new Error('No output! Choose blocks to show in results')
          }
          if (this.modelParams.steps > 100000) {
            throw new Error('Interval overflow! Max number of time steps is 100,000')
          }
          if (this.methodParams.samples > 10000000) {
            throw new Error('Samples overflow! Max number of samples is 10,000,000')
          }
          if (this.server && this.serverURL.length) {
            // Server-side simulation
            // Store server url in cookies
            console.log('Server-side simulation: ', this.serverURL)
            fetch(this.serverURL, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({code: this.code, api: this.serverAPI})
            })
              .then((r) => {
                return r.json()
              })
              .then((data) => {
                console.log(data)
                if (data.error) {
                  errorHandler(new Error(data.error))
                } else {
                  if (data.charts && data.charts.length) {
                    data.charts.forEach(chart => {
                      const ch = document.createElement('img')
                      ch.src = chart
                      document.querySelector('.charts-extra').appendChild(ch)
                    })
                  }
                  this.processResults(data.v)
                }
              })
          } else {
            webppl.run(this.code, (s, v) => {
              this.processResults(v)
            }) // *webppl.run()
          }
        } catch (err) {
          errorHandler(err)
        }
      }, 500)
    }
  }
}

module.exports = params
