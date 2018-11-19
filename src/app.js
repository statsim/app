const parseCSV = require('csv-parse')
const fileSaver = require('file-saver')
const cookie = require('cookie')
const D3Network = require('vue-d3-network')
const VueVis = require('vue2vis')
const draggable = require('vuedraggable')
const Table = require('handsontable')
const Qty = require('js-quantities')
const VueColor = require('vue-color')
const distributions = require('./lib/distributions')
const simulationMethods = require('./lib/methods')
const compileModels = require('./lib/compileModels')
const processResults = require('./lib/processResults')
const createLink = require('./lib/createLink')
const parseLink = require('./lib/parseLink')
const icons = require('./lib/icons')
// const graphIcons = require('./lib/graphIcons')
const guessUnits = require('./lib/guessUnits')

// Access global objects
const Blob = window['Blob']
const fetch = window['fetch']
const FileReader = window['FileReader']
const Worker = window['Worker']

const baseModel = [
  {
    modelParams:
    {
      name: 'Main',
      description: '',
      steps: 1,
      method: 'deterministic'
    },
    blocks: [],
    methodParams:
    {
      chains: 1,
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
  '#530ea3',
  '#1e33cc'
]

const networkOptions = {
  autoResize: true,
  height: '100%',
  width: '100%',
  locale: 'en',
  nodes: {
    shape: 'circle',
    font: {
      size: 18,
      color: '#888888'
    },
    scaling: {
      label: {
        min: 8,
        max: 50
      }
    },
    borderWidth: 0,
    shadow: false,
    margin: {
      top: 10,
      left: 20,
      right: 20,
      bottom: 10
    },
    color: {
      border: '',
      background: '#b2dfdb',
      highlight: {
        border: '#e57373',
        background: '#ffcdd2'
      }
    }
  },
  layout: {
    improvedLayout: true,
    hierarchical: {
      enabled: false,
      direction: 'UD',
      sortMethod: 'hubsize',
      parentCentralization: true,
      blockShifting: true,
      edgeMinimization: true
    }
  },
  edges: {
    smooth: true,
    chosen: true,
    arrows: {
      to: {
        enabled: true,
        type: 'arrow'
      }
    },
    color: {
      color: '#888',
      highlight: '#0042FF',
      hover: '#999',
      inherit: 'from',
      opacity: 0.5
    }
  },
  groups: {
    0: {
      shape: 'dot',
      color: '#eaac0c', // RV
      size: 10
    },
    1: {
      shape: 'dot',
      color: '#0097cc', // Exp
      size: 10
    },
    2: {
      shape: 'dot',
      color: '#84c161',
      size: 10 // Data
    },
    3: {
      shape: 'icon',
      icon: {
        face: 'Material Icons',
        code: '\ue146',
        size: 30,
        color: '#c44a78'
      }
    },
    4: {
      shape: 'diamond',
      color: '#ababab', // observer
      size: 10
    },
    5: {
      shape: 'icon',
      icon: {
        face: 'Material Icons',
        code: '\ue86c',
        size: 40,
        color: '#ababab'
      }
    },
    6: {
      shape: 'square',
      color: '#530ea3', // nn
      size: 15
    },
    7: {
      shape: 'triangle',
      color: '#1e33cc', // function
      size: 10
    }
  },
  physics: {
    enabled: true,
    barnesHut: {
      gravitationalConstant: -2000
    }
  }
}

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
      this.units = ''
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
      this.units = ''
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
      this.units = ''
      this.dataType = ''
      this.dataCategories = ''
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
      this.units = ''
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
  },
  class NeuralNet {
    constructor (counter) {
      this.name = 'N' + counter
      this.type = 'Neural Net'
      this.typeCode = 6
      this.layers = []
      this.convert = false
    }
  },
  class Func {
    constructor (counter) {
      this.name = 'F' + counter
      this.type = 'Function'
      this.typeCode = 7
      this.x = ''
      this.y = ''
      this.min = ''
      this.max = ''
      this.tableFunction = false
    }
  }
]

function delay (time, cb) {
  this.loading = true
  setTimeout(() => {
    this.loading = false
    cb()
  }, time)
}

// Future HotTable object
let table

console.log(VueColor)

const params = {
  components: {
    D3Network,
    'color-picker': VueColor.Swatches,
    draggable,
    Network: VueVis.Network
  },
  data: () => ({
    chooseIconForBlock: -1,
    currentBlockColor: '#ababab',
    icons,
    networkOptions,
    units: Qty.getUnits().map(u => ({ name: u })),
    colors,
    theme: 'light',
    preview: false,
    link: '',
    loading: false, // show loading indicator
    message: '',
    error: '',
    reactiveDataTable: false,
    server: false, // server-side processing
    serverURL: '',
    serverAPI: '',
    showDataTable: false, // to show or not data table
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
      console.log(new Date(), 'Nodes: Starting dynamic update')
      const nodes = this.blocks
        .map((b, i) => {
          let node = {
            id: i,
            label: (b.name && b.name.length) ? `${b.name}` : b.type
          }
          if (b.icon && b.icon.length) {
            node.group = 'icon'
            node.shape = 'icon'
            node.icon = {
              face: 'Material Icons',
              code: b.icon,
              size: b.size ? b.size : 40,
              color: (b.color && b.color.length) ? b.color : '#ababab'
            }
          } else {
            node.group = b.typeCode
          }
          return node
        })
        .concat(this.models.filter((_, i) => i !== this.activeModel).map((m, i) => ({
          id: (this.blocks.length ? this.blocks.length + i : i),
          // name: m.modelParams.name,
          label: m.modelParams.name,
          shape: 'icon',
          group: 'icon',
          icon: {
            face: 'Material Icons',
            code: '\ue886',
            size: 40,
            color: '#ffffff'
          }
        })))
      console.log(new Date(), 'Nodes: returning nodes', nodes)
      return nodes
    },
    graphLinks: function () {
      console.log(new Date(), 'Links: generating network links')
      const check = (str, baseBlockIndex) => {
        const l = []
        if (typeof str === 'string') {
          this.blocks.forEach((b, i) => {
            if (b.name && (str.split(/[^A-Za-z0-9_]/g).indexOf(b.name) >= 0)) {
              l.push({
                // tid: baseBlockIndex,
                // sid: i,
                to: baseBlockIndex,
                from: i,
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
      console.log(new Date(), 'Links: returning links', links.length)
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
      let query = window.location.search
      if (query.indexOf('preview') > 0) {
        this.preview = true
      }
      parseLink(
        query,
        ({ models, activeModel }) => {
          setTimeout(() => {
            this.models = models
            this.switchModel(0 || activeModel)
            // Add ID to each block for better list rendering
            this.models.forEach(m => {
              m.blocks.forEach(b => {
                b.id = 'b' + Math.round(Math.random() * 100000000)
              })
            })
          }, 100)
        },
        (err) => {
          this.error = err
        }
      )
    } // *if window.location.search is not empty
  },
  methods: {
    fitNetwork () {
      // Scale network to fit all nodes
      setTimeout(() => {
        console.log('Network fitter: fiting the net')
        this.$refs.network.fit({
          animation: {
            duration: 500
          }
        })
      }, 1500)
    },
    selectNode (selection) {
      console.log('Selected', selection)
      const block = document.getElementById('block-id-' + selection.nodes[0])
      const offset = block.offsetTop
      document.getElementById('side-bar').scrollTop = offset - 20
      this.$set(this.blocks[selection.nodes[0]], 'minimized', false)
    },
    chooseIcon (icon) {
      this.$set(this.blocks[this.chooseIconForBlock], 'icon', icon)
      this.$set(this.blocks[this.chooseIconForBlock], 'color', colors[this.blocks[this.chooseIconForBlock].typeCode])
      this.$set(this.blocks[this.chooseIconForBlock], 'size', 40)
      this.chooseIconForBlock = -1
    },
    // Update data blocks from table inner data
    guessUnits (str, i) {
      this.blocks[i].units = guessUnits(str, this.blocks)
    },
    updateData () {
      // Convert array to a comma-separated string
      function toStringList (arr) {
        // Find lat non empty value
        let lastIndexNonEmpty = arr.length - 1
        for (let i = lastIndexNonEmpty; i > 0; i--) {
          if (!arr[i] || arr[i].trim() === '') lastIndexNonEmpty--
          else break
        }
        // Trim array
        let a = arr.slice(0, lastIndexNonEmpty + 1)
        // Convert array to string
        return a.toString()
      }
      delay.call(this, 300, () => {
        // Check if table exist
        if (table) {
          let data = table.getData()
          // Get headers stored in the first line
          let headers = data.shift(1)
          // Remove blocks not present in the table
          for (let i = this.blocks.length - 1; i >= 0; i--) {
            let block = this.blocks[i]
            if ((block.typeCode === 2) && (!headers.includes(block.name))) {
              console.log(`Table: Vue, remove block ${block.name}, please.`)
              this.blocks.splice(i, 1)
            }
          }
          // Update data-blocks values
          headers.forEach((h, hi) => {
            // Check if header cell is not empty
            if (h.length) {
              // Find index of that header in the blocks array
              const headerInBlocks = this.blocks.map(b => b.name).indexOf(h)
              if (headerInBlocks < 0) {
                // No such data-block, add new
                this.blocks.push(
                  new BlockClasses[2](
                    h, // Name
                    toStringList(data.map(d => d[hi])) // Value
                  )
                )
              } else {
                // Just update existing block
                this.blocks[headerInBlocks].value = toStringList(data.map(d => d[hi]))
              }
            } // *header not empty
          }) // *header iterator
        } // *if table exist
      }) // *delay
    },
    drawDataTable () {
      // Draw table only if the corresponding flag is set
      if (this.showDataTable) {
        delay.call(this, 300, () => {
          const app = this

          // Function called on each table update
          function upd () {
            if (app.reactiveDataTable) {
              app.updateData()
            }
          }

          let dataBlocks = this.blocks.filter(b => b.typeCode === 2)

          // Create data array in the table-friendly format
          // First row contain headers
          let data = [dataBlocks.map(b => b.name)]

          // Now add values
          dataBlocks.forEach((b, bi) => {
            b.value
              .split(',')
              .map(v => v.trim())
              .forEach((v, vi) => {
                if (!data[vi + 1]) data[vi + 1] = []
                data[vi + 1][bi] = v
              })
          })

          // Fill extra cells 10x20 for better user experience
          let length = Math.max(20, data.length)
          for (let i = 0; i <= length; i++) {
            if (!Array.isArray(data[i])) {
              data[i] = []
            }
            for (let j = 0; j <= 10; j++) {
              if (!data[i][j]) data[i][j] = ''
            }
          }

          var container = document.querySelector('.table-wrapper')
          // Clear old table
          container.innerHTML = ''
          // Create a new table
          table = new Table(container, {
            data,
            contextMenu: true,
            observeChanges: false,
            afterChange: upd,
            afterColumnMove: upd,
            afterColumnSort: upd,
            afterCut: upd,
            afterMergeCells: upd,
            afterPaste: upd,
            afterRemoveCol: upd,
            afterRemoveRow: upd,
            afterRowMove: upd,
            afterRowResize: upd,
            afterUndo: upd,
            allowInsertColumn: true,
            allowRemoveColumn: true,
            allowInsertRow: true,
            allowRemoveRow: true,
            autoColumnSize: {
              samplingRatio: 23
            },
            dropdownMenu: true,
            fixedRowsTop: 1,
            manualRowMove: true,
            manualColumnMove: true,
            rowHeaders: function (index) {
              return (index > 0) ? index : ''
            },
            stretchH: 'all',
            cells: function (row, col) {
              let cellProperties = {}
              if (row === 0) {
                cellProperties.renderer = function firstRowRenderer (instance, td, row, col, prop, value, cellProperties) {
                  Table.renderers.TextRenderer.apply(this, arguments)
                  td.style.fontWeight = 'bold'
                  td.style.color = 'black'
                  td.style.background = '#EEE'
                }
              }
              return cellProperties
            }
          }) // *table cosntructor
        }) // *delay
      } // *if showDataTable
    },
    addLayer (blockIndex) {
      const block = this.blocks[blockIndex]
      block.layers.push({
        type: 'affine',
        name: 'layer' + (block.layers.filter(l => l.type === 'affine').length + 1),
        in: 1,
        out: 1
      })
    },
    // Add new expression to Expression value (via helper buttons)
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
      this.showDataTable = false
      delay.call(this, 500, () => {
        // Switch to edit mode
        this.preview = false
        // Update history
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
            // Update table
            if (this.reactiveDataTable && this.showDataTable) this.drawDataTable()
          } else {
            console.log(err)
          }
        })
      }
    },
    openProjectFile (e) {
      this.showDataTable = false
      const reader = new FileReader()
      const file = e.target.files[0]
      reader.readAsText(file)
      reader.onload = () => {
        console.log(new Date(), 'Reader: Opened the file of length', reader.result.length)
        const models = JSON.parse(reader.result)
        delay.call(this, 500, () => {
          window.history.replaceState({}, 'New project', '.')
          console.log(new Date(), 'Reader: Updating models')
          this.models = Array.isArray(models) ? models : [models]
          console.log(new Date(), 'Reader: Models updated!')
          // Add ID to each block for better list rendering
          this.models.forEach(m => {
            m.blocks.forEach(b => {
              this.$set(b, 'id', ((b.id) ? b.id : 'b' + Math.round(Math.random() * 100000000)))
            })
          })
          this.switchModel(0)
          console.log(new Date(), 'Reader: Model switched to 0')
          this.fitNetwork()
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
          steps: 1,
          include: []
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
      this.error = ''
      if (modelId < 0 || modelId > this.models.length - 1) {
        this.error = 'Invalid model number. Switching to first model'
        modelId = 0
      }
      const m = this.models[modelId]
      this.link = '' // clean code
      this.message = ''
      const chartContainer = document.querySelector('.charts')
      if (chartContainer) {
        chartContainer.innerHTML = ''
        document.querySelector('.charts-2d').innerHTML = ''
      }
      m.blocks.forEach(b => {
        b.minimized = true
      })
      this.activeModel = modelId
      this.blocks = m.blocks
      this.modelParams = m.modelParams
      this.methodParams = m.methodParams
      // Update table
      if (this.reactiveDataTable && this.showDataTable) this.drawDataTable()
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
    unitsFilter (list, query) {
      const arr = []
      for (let i = 0; i < list.length; i++) {
        if (list[i].hasOwnProperty('name') && (list[i].name.toLowerCase().indexOf(query.toLowerCase()) !== -1)) {
          arr.push(list[i])
        }
        if (arr.length > 5) {
          break
        }
      }
      return arr
    },
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
        this.link = createLink(this.models, this.preview, this.activeModel)
      })
    },
    generateJSON () {
      delay.call(this, 600, () => {
        this.link = JSON.stringify(this.models, null, 2) // indent with 2 spaces
      })
    },
    toggle (blockIndex) {
      this.$set(this.blocks[blockIndex], 'minimized', !this.blocks[blockIndex].minimized)
    },
    maximizeAllBlocks () {
      this.blocks.forEach(b => this.$set(b, 'minimized', false))
    },
    minimizeAllBlocks () {
      this.blocks.forEach(b => this.$set(b, 'minimized', true))
    },
    addBlock (blockClassNumber) {
      let block = new BlockClasses[blockClassNumber](this.blocks.length)
      block.minimized = false
      block.id = 'b' + Math.round(Math.random() * 100000000)
      this.blocks.push(block)
      // If data added, update table
      if ((blockClassNumber === 2) && this.reactiveDataTable && this.showDataTable) {
        this.drawDataTable()
      } else if ((blockClassNumber === 0) && (this.modelParams.method === 'deterministic') && (this.blocks.filter(b => b.typeCode === 0).length === 1)) {
        // Random variable added
        // Should we check the simulation method?
        // Probably yes!
        this.modelParams.method = 'rejection'
      } else if ((blockClassNumber === 4) && (['deterministic', 'rejection', 'forward', 'enumerate'].includes(this.modelParams.method))) {
        this.modelParams.method = 'MCMC'
      }
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
      const typeCode = this.blocks[blockIndex].typeCode
      this.blocks.splice(blockIndex, 1)
      // Redraw data table if data removed
      if ((typeCode === 2) && this.reactiveDataTable && this.showDataTable) this.drawDataTable()
    },
    compile () {
      // Convert available models (this.models) to the probabilistic lang
      this.code = compileModels(this.models, this.activeModel)
      console.log('Vue: F* yeah! Got compiled code!')
    },
    process (data) {
      this.loading = false
      document.getElementById('loader').className = 'hidden'
      this.message = 'Done!'
      processResults(data, this.blocks, this.modelParams)
    },
    run () {
      const errorHandler = (err) => {
        this.loading = false
        document.getElementById('loader').className = 'hidden'
        this.error = err.message
      }

      document.querySelector('.charts').innerHTML = ''
      document.querySelector('.charts-2d').innerHTML = ''
      document.querySelector('.charts-extra').innerHTML = ''
      document.querySelector('.archives').innerHTML = ''
      document.getElementById('loader').className = ''

      this.loading = true
      this.link = ''
      this.message = ''
      this.error = ''

      document.cookie = 'url=' + this.serverURL
      document.cookie = 'api=' + this.serverAPI
      document.cookie = 'server=' + this.server

      this.compile()

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
          if (this.modelParams.steps > 1000000) {
            throw new Error('Interval overflow! Max number of time steps is 1,000,000')
          }
          if (this.methodParams.samples > 10000000) {
            throw new Error('Samples overflow! Max number of samples is 10,000,000')
          }
          if (this.server && this.serverURL.length) {
            // Server-side simulation
            // Store server url in cookies
            console.log('Vue: sending the code to', this.serverURL)
            fetch(this.serverURL, {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                models: this.models,
                activeModel: this.activeModel,
                api: this.serverAPI,
                compile: this.serverCompile
              })
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
                  if (data.archives && data.archives.length) {
                    data.archives.forEach(arc => {
                      const link = `<div class="archive"><span clas="archive-icon">⇣</span> <a href="${arc}">${arc.split('/').pop()}</a></div>`
                      document.querySelector('.archives').innerHTML += link
                    })
                  }
                  this.process(data.v)
                }
              })
          } else {
            // Browser-side simulation
            console.log('Vue: Sending the code to workers..')

            let workers = [] // Array of promisified worker

            let nw = 1 // Number of workers
            if (
              (this.methodParams.chains) &&
              (this.methodParams.chains > 1) &&
              (this.modelParams.method !== 'deterministic')
            ) {
              nw = +this.methodParams.chains
            }

            for (let i = 0; i < nw; i++) {
              workers.push(
                new Promise((resolve, reject) => {
                  let w = new Worker('dist/worker.js')
                  w.postMessage(this.code)
                  w.onmessage = (msg) => {
                    console.log(`Vue: Received reply from Worker ${i}`)
                    resolve(msg.data)
                  }
                  w.onerror = reject
                })
              ) // *push
            }

            Promise.all(workers)
              .then((data) => {
                console.log(data)
                this.process(data)
              })
              .catch((err) => {
                errorHandler(err)
              })
          } // *broser-side simulation
        } catch (err) {
          errorHandler(err)
        }
      }, 300)
    }
  }
}

module.exports = params
