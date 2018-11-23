// NPM deps
const parseCSV = require('csv-parse')
const fileSaver = require('file-saver')
const cookie = require('cookie')
const VueVis = require('vue2vis')
const draggable = require('vuedraggable')
const Table = require('handsontable')
const Qty = require('js-quantities')
const VueColor = require('vue-color')
const Scrollbar = require('vue2-perfect-scrollbar')

// Local deps
const distributions = require('./lib/distributions')
const simulationMethods = require('./lib/methods')
const compileModels = require('./lib/compileModels')
const processResults = require('./lib/processResults')
const createLink = require('./lib/createLink')
const parseLink = require('./lib/parseLink')
const icons = require('./lib/icons')
const createBaseModel = require('./lib/createBaseModel')
const guessUnits = require('./lib/guessUnits')
const BlockClasses = require('./lib/blockClasses')

// Access global objects
const Blob = window['Blob']
const fetch = window['fetch']
const FileReader = window['FileReader']
const Worker = window['Worker']

// Block colors
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

// Network options object
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
      color: colors[0], // RV
      size: 10
    },
    1: {
      shape: 'dot',
      color: colors[1], // Exp
      size: 10
    },
    2: {
      shape: 'dot',
      color: colors[2],
      size: 10 // Data
    },
    3: {
      shape: 'icon',
      icon: {
        face: 'Material Icons',
        code: '\ue146',
        size: 30,
        color: colors[3]
      }
    },
    4: {
      shape: 'diamond',
      color: colors[4], // observer
      size: 10
    },
    5: {
      shape: 'icon',
      icon: {
        face: 'Material Icons',
        code: '\ue86c',
        size: 40,
        color: colors[5]
      }
    },
    6: {
      shape: 'square',
      color: colors[6], // nn
      size: 15
    },
    7: {
      shape: 'triangle',
      color: colors[7], // function
      size: 10
    },
    'shadow': {
      shape: 'dot',
      color: '#ababab', // shadow
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

// Delay showing loading indicator
function delay (time, cb) {
  this.loading = true
  setTimeout(() => {
    this.loading = false
    cb()
  }, time)
}

// Future HotTable object
// Need it here to easily call from any app method
let table

const params = {
  /*
    COMPONENTS
  */
  components: {
    'color-picker': VueColor.Swatches,
    'draggable': draggable,
    'network': VueVis.Network,
    'scrollbar': Scrollbar.PerfectScrollbar
  },

  /*
    DATA
  */
  data: () => ({
    activeModel: 0, // Selected model
    chooseIconForBlock: -1, // If > 0 icon selector activates
    code: '', // Compiled webppl code
    colors, // Array of block colors
    error: '', // Error string, activates error bar
    icons, // List of icons with codes
    link: '', // Generated URL
    loading: false, // Show loading indicator?
    message: '', // Any message in top bar
    models: [], // Array of project models
    networkOptions, // Graph opts
    preview: false, // Preview mode?
    reactiveDataTable: false, // Update data from table reactively?
    server: false, // Server-side processing
    serverAPI: '',
    serverURL: '',
    showDataTable: false, // Show or not data table?
    simulationMethods, // Array of simulation methods
    theme: 'light', // Current theme
    units: Qty.getUnits().map(u => ({ name: u })) // All units
  }),

  /*
    COMPUTED PROPERTIES
  */
  computed: {
    // Calculated list of distributions
    // Based on predefined distributions from lib/distributions.js
    // Also new user-defined models added
    distributions () {
      const newDistributions = {}
      // Iterate over all models
      this.models
        // Skip active and deterministic models
        .filter((m, i) => {
          return ((i !== this.activeModel) && (m.modelParams.method !== 'deterministic'))
        })
        // Iterate
        .forEach(m => {
          const distributionParameters = {}
          // Collect all data fields with useAsParameter attributes
          m.blocks
            .filter(b => ((b.typeCode === 2) && (b.useAsParameter)))
            .forEach(b => {
              distributionParameters[b.name] = {
                type: 'any'
              }
            })
          newDistributions[m.modelParams.name] = distributionParameters
        })
      // Merge base distributions and generated ones
      return Object.assign({}, newDistributions, distributions)
    },
    shadowNodes: function () {
      // Stringify current blocks to easily search for variable
      // let blockString = JSON.stringify(this.models[this.activeModel].blocks)
      let sn = []
      // Check for shadow nodes only if multiple models
      if (this.models.length > 1) {
        console.log('Shadow pirate: Start searching!')
        let blockString = JSON.stringify(this.models[this.activeModel].blocks).split(/[^A-Za-z0-9_]/g).filter(el => el.length)
        // Iterate over all non active models
        this.models.filter((_, i) => i !== this.activeModel).forEach((m, mi) => {
          // Check model first (shadow model)
          if (m.modelParams.name && (blockString.indexOf(m.modelParams.name) >= 0)) {
            sn.push({
              id: m.modelParams.name,
              label: m.modelParams.name,
              shape: 'icon',
              group: 'icon',
              icon: {
                face: 'Material Icons',
                code: '\ue886',
                size: 60,
                color: '#ababab'
              }
            })
          }
          // Check model blocks (shadow blocks)
          if (this.models[this.activeModel].modelParams.include && this.models[this.activeModel].modelParams.include.length) {
            m.blocks.forEach((b, bi) => {
              if (b.name && (blockString.indexOf(b.name) >= 0)) {
                sn.push({
                  id: m.modelParams.name + bi,
                  label: b.name,
                  group: 'shadow'
                })
              }
            })
          }
        })
      }
      // console.log(new Date(), 'Shadow nodes', sn)
      return sn
    },
    graphNodes: function () {
      // console.log(new Date(), 'Nodes: Starting dynamic update')
      const nodes = this.models[this.activeModel].blocks
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
          if (b.pos) {
            node.x = b.pos.x
            node.y = b.pos.y
            delete b.pos
          }
          return node
        })
        .concat(this.shadowNodes)
      // console.log(new Date(), 'Nodes: returning nodes', nodes)
      return nodes
    },
    graphLinks: function () {
      // console.log(new Date(), 'Links: generating network links')
      const check = (str, baseBlockIndex) => {
        const l = []
        if (typeof str === 'string') {
          this.models[this.activeModel].blocks.forEach((b, i) => {
            if (b.name && (str.split(/[^A-Za-z0-9_]/g).indexOf(b.name) >= 0)) {
              l.push({
                // tid: baseBlockIndex,
                // sid: i,
                to: baseBlockIndex,
                from: i
              })
            }
          })
          this.shadowNodes.forEach((s, i) => {
            if (s.label && (str.split(/[^A-Za-z0-9_]/g).indexOf(s.label) >= 0)) {
              l.push({
                to: baseBlockIndex,
                from: s.id
              })
            }
          })
        }
        return l
      }
      let links = []
      this.models[this.activeModel].blocks.forEach((b, i) => {
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
      // console.log(new Date(), 'Links: returning links', links.length)
      return links
    }
  },
  created () {
    // Before mounting
    // Check theme
    this.theme = (document.cookie.indexOf('dark') > 0) ? 'dark' : 'light'
    const c = cookie.parse(document.cookie)
    this.server = (c.server === 'true')
    this.serverURL = c.url ? c.url : ''
    this.serverAPI = c.api ? c.api : ''
  },
  mounted () {
    // After mounting
    if (window.location.search) {
      let query = window.location.search
      if (query.indexOf('preview') > 0) {
        this.preview = true
      }
      parseLink(
        query,
        ({ models, activeModel }) => {
          models.forEach(m => {
            // Add include field to each model
            if (typeof m.modelParams.include === 'undefined') {
              m.modelParams.include = []
            }
            // Add ID to each block for better list rendering
            m.blocks.forEach(b => {
              b.id = 'b' + Math.round(Math.random() * 100000000)
            })
            this.models = models
            this.switchModel(0 || activeModel)
          })
        },
        (err) => {
          this.error = err
        }
      )
    } else { // *if window.location.search is not empty
      this.models = [createBaseModel('Main')]
      this.switchModel(0)
    }
  },
  methods: {
    set (obj, param, value) {
      this.$set(obj, param, value)
    },
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
      if (!isNaN(parseInt(selection.nodes[0]))) {
        const block = document.getElementById('block-id-' + this.activeModel + '-' + selection.nodes[0])
        const offset = block.offsetTop
        document.getElementById('side-bar').scrollTop = offset - 20
        this.$set(this.models[this.activeModel].blocks[selection.nodes[0]], 'minimized', false)
      }
    },
    chooseIcon (icon) {
      this.$set(this.models[this.activeModel].blocks[this.chooseIconForBlock], 'icon', icon)
      this.$set(this.models[this.activeModel].blocks[this.chooseIconForBlock], 'color', colors[this.models[this.activeModel].blocks[this.chooseIconForBlock].typeCode])
      this.$set(this.models[this.activeModel].blocks[this.chooseIconForBlock], 'size', 40)
      this.chooseIconForBlock = -1
    },
    // Update data blocks from table inner data
    guessUnits (str, i) {
      this.models[this.activeModel].blocks[i].units = guessUnits(str, this.models[this.activeModel].blocks)
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
          for (let i = this.models[this.activeModel].blocks.length - 1; i >= 0; i--) {
            let block = this.models[this.activeModel].blocks[i]
            if ((block.typeCode === 2) && (!headers.includes(block.name))) {
              console.log(`Table: Vue, remove block ${block.name}, please.`)
              this.models[this.activeModel].blocks.splice(i, 1)
            }
          }
          // Update data-blocks values
          headers.forEach((h, hi) => {
            // Check if header cell is not empty
            if (h.length) {
              // Find index of that header in the blocks array
              const headerInBlocks = this.models[this.activeModel].blocks.map(b => b.name).indexOf(h)
              if (headerInBlocks < 0) {
                // No such data-block, add new
                const block = new BlockClasses[2](
                  h, // Name
                  toStringList(data.map(d => d[hi])) // Value
                )
                block.id = Math.round(Math.random() * 100000000)

                this.models[this.activeModel].blocks.push(block)
              } else {
                // Just update existing block
                this.models[this.activeModel].blocks[headerInBlocks].value = toStringList(data.map(d => d[hi]))
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

          let dataBlocks = this.models[this.activeModel].blocks.filter(b => b.typeCode === 2)

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
      const block = this.models[this.activeModel].blocks[blockIndex]
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
      const value = this.models[this.activeModel].blocks[i].value
      this.models[this.activeModel].blocks[i].value = value.slice(0, pos) + str + value.slice(pos)
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
        // Switch to firstModel model
        this.switchModel(0)
        // Clean models
        this.models = [createBaseModel('Main')]
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
                this.models[this.activeModel].blocks.push(new BlockClasses[2](
                  h,
                  // Filter out the first line
                  output.filter((_, i) => i > 0).map(v => v[hi])
                ))
              })
            } else {
              // Comma-separated line
              this.models[this.activeModel].blocks.push(new BlockClasses[2](file.name.split('.')[0], output))
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
          this.switchModel(0)
          console.log(new Date(), 'Reader: Updating models')
          this.models = Array.isArray(models) ? models : [models]
          console.log(new Date(), 'Reader: Models updated!')
          this.models.forEach(m => {
            // Add include field to each model
            if (typeof m.modelParams.include === 'undefined') {
              m.modelParams.include = []
            }
            // Add ID to each block for better list rendering
            m.blocks.forEach(b => {
              this.$set(b, 'id', ((b.id) ? b.id : 'b' + Math.round(Math.random() * 100000000)))
            })
          })
          this.fitNetwork()
        })
      }
    },
    saveProject () {
      // Store current model nodes positions
      this.models[this.activeModel].blocks.forEach((b, bi) => {
        b.pos = this.$refs.network.getPositions([bi])[bi]
      })
      const blob = new Blob([JSON.stringify(this.models, null, 2)], {type: 'text/plain;charset=utf-8'})
      fileSaver.saveAs(blob, this.models[0].modelParams.name + '.json')
    },
    // Open remove model dialog
    openDialog (ref) {
      this.$refs[ref].open()
    },
    createModel () {
      this.models.push(createBaseModel('Model' + this.models.length))
      this.switchModel(this.models.length - 1)
    },
    switchModel (modelId) {
      console.log('Vue: switching to model', modelId)
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
        this.$set(b, 'minimized', true)
      })

      // Get current positions
      if (this.$refs.network) {
        this.models[this.activeModel].blocks.forEach((b, bi) => {
          console.log('Network: get pos')
          b.pos = this.$refs.network.getPositions([bi])[bi]
        })
      }

      this.activeModel = modelId
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
      this.$set(
        this.models[this.activeModel].blocks[blockIndex],
        'minimized',
        !this.models[this.activeModel].blocks[blockIndex].minimized
      )
    },
    maximizeAllBlocks () {
      this.models[this.activeModel].blocks.forEach(b => this.$set(b, 'minimized', false))
    },
    minimizeAllBlocks () {
      this.models[this.activeModel].blocks.forEach(b => this.$set(b, 'minimized', true))
    },
    addBlock (blockClassNumber) {
      let block = new BlockClasses[blockClassNumber](this.models[this.activeModel].blocks.length)
      block.minimized = false
      block.id = 'b' + Math.round(Math.random() * 100000000)
      this.models[this.activeModel].blocks.push(block)
      // If data added, update table
      if ((blockClassNumber === 2) && this.reactiveDataTable && this.showDataTable) {
        this.drawDataTable()
      } else if ((blockClassNumber === 0) && (this.models[this.activeModel].modelParams.method === 'deterministic') && (this.models[this.activeModel].blocks.filter(b => b.typeCode === 0).length === 1)) {
        // Random variable added
        // Should we check the simulation method?
        // Probably yes!
        this.models[this.activeModel].modelParams.method = 'rejection'
      } else if ((blockClassNumber === 4) && (['deterministic', 'rejection', 'forward', 'enumerate'].includes(this.models[this.activeModel].modelParams.method))) {
        this.models[this.activeModel].modelParams.method = 'MCMC'
      }
    },
    moveBlockToTop (blockIndex) {
      if (blockIndex > 0) {
        this.models[this.activeModel].blocks.splice(0, 0, this.models[this.activeModel].blocks.splice(blockIndex, 1)[0])
      }
    },
    moveBlockUp (blockIndex) {
      if (blockIndex > 0) {
        this.models[this.activeModel].blocks.splice(blockIndex - 1, 0, this.models[this.activeModel].blocks.splice(blockIndex, 1)[0])
      }
    },
    moveBlockDown (blockIndex) {
      if (blockIndex < this.models[this.activeModel].blocks.length - 1) {
        this.models[this.activeModel].blocks.splice(blockIndex + 1, 0, this.models[this.activeModel].blocks.splice(blockIndex, 1)[0])
      }
    },
    removeBlock (blockIndex) {
      const typeCode = this.models[this.activeModel].blocks[blockIndex].typeCode
      this.models[this.activeModel].blocks.splice(blockIndex, 1)
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
      processResults(data, this.models[this.activeModel].blocks, this.models[this.activeModel].modelParams)
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
          if (!this.models[this.activeModel].blocks.length) {
            throw new Error('Empty model! Click ADD BLOCK to start designing the model!')
          }
          if (!this.models[this.activeModel].blocks.reduce((acc, b) => acc || b.show, false)) {
            throw new Error('No output! Choose blocks to show in results')
          }
          if (this.models[this.activeModel].modelParams.steps > 1000000) {
            throw new Error('Interval overflow! Max number of time steps is 1,000,000')
          }
          if (this.models[this.activeModel].methodParams.samples > 10000000) {
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
              (this.models[this.activeModel].methodParams.chains) &&
              (this.models[this.activeModel].methodParams.chains > 1) &&
              (this.models[this.activeModel].modelParams.method !== 'deterministic')
            ) {
              nw = +this.models[this.activeModel].methodParams.chains
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
