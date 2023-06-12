const version = require('../package.json').version

// NPM deps
// const parseCSV = require('csv-parse')
const fileSaver = require('file-saver')
const cookie = require('cookie')
const draggable = require('vuedraggable')
const Table = require('handsontable')
const Qty = require('js-quantities')
const VueColor = require('vue-color')
const beautify = require('js-beautify').js
const Stats = require('online-stats')

// Local deps
const BlockClasses = require('./lib/blockClasses')
const cleanModels = require('./lib/cleanModels')
const compileModels = require('./lib/compile-wppl')
const compilePYMC3 = require('./lib/compile-pymc3')
const compileTFP = require('./lib/compile-tfp')
const compileTFJS = require('./lib/compile-tfjs')
const compileZ3 = require('./lib/compile-z3')
const copyText = require('./lib/copy')
const createBaseModel = require('./lib/createBaseModel')
const createLink = require('./lib/createLink')
const distributions = require('./lib/distributions')
const expressions = require('./lib/expressions')
const guessUnits = require('./lib/guessUnits')
const icons = require('./lib/icons')
const parseLink = require('./lib/parseLink')
const preprocessDataframe = require('./lib/preprocessDataframe')
const previewDataframe = require('./lib/previewDataframe')
const processDataframe = require('./lib/processDataframe')
const processModels = require('./lib/processModels')
const processResults = require('./lib/processResults')
const simulationMethods = require('./lib/methods')
const samplesToCSV = require('./lib/samplesToCSV')
// const getXmlStreamStructure = require('./lib/get-xml-stream-structure.js') // Get XML nodes and repeated node

import colors from './lib/blockColors'

// Access global objects
const Blob = window['Blob']
const fetch = window['fetch']
const FileReader = window['FileReader']
const Worker = window['Worker']

// For theme switch
import { useTheme } from 'vuetify'

// Vue components
import DialogsComponent from './components/Dialogs.vue'
import SidebarComponent from './components/Sidebar.vue'
import NetworkComponent from './components/Network.vue'
import InputsComponent from './components/Inputs.vue'
import MenuComponent from './components/Menu.vue'

// Use flow here for easier access for now
// TODO: move to separate file and call with $refs
// import FlowComponent from './components/Flow.vue'

// Flow (Baklava)
import { EditorComponent, useBaklava } from "@baklavajs/renderer-vue";
import "@baklavajs/themes/dist/syrup-dark.css";

// Flow helpers (Nodes, Converter)
import nodes from './lib/flowNodes' 
import { blocksToFlow, flowToBlocks } from './lib/flowConvert'
import { e, p } from './lib/abbr'

// Define a custom node
// import { defineNode, NodeInterface, NumberInterface, SelectInterface } from "baklavajs";
// const Node = defineNode({
//     type: "MyNode",
//     inputs: {
//         number1: () => new NumberInterface("Number", 1),
//         number2: () => new NumberInterface("Number", 10),
//         operation: () => new SelectInterface("Operation", "Add", ["Add", "Subtract"]).setPort(false),
//     },
//     outputs: {
//         output: () => new NodeInterface("Output", 0),
//     },
// })

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

// Temorary store model ID here before calling confirmation prompt
// After confirmation, it will be used to delete the model
let modelToRemove

const regCSV = RegExp('\\.csv', 'i')
const regTSV = RegExp('\\.tsv', 'i')
const regXML = RegExp('\\.xml', 'i')

function init (files, modelId) {
  const model = this.models[modelId]
  let fileName = files
  console.log('[Init] Files: ', files)
  if (typeof files === 'string') {
    // URL
    fileName = files
    // model.pipeline.source.url = fileName
  } else if ((typeof files === 'object') && (files !== null)) {
    // File List
    fileName = files[0].name
    model.pipeline.source.fileList = files
  }
  if (regCSV.test(fileName) || regTSV.test(fileName)) {
    model.pipeline.source.format = 'csv'
  } else if (regXML.test(fileName)) {
    model.pipeline.source.format = 'xml'
  } else {
    model.pipeline.source.format = 'text'
  }

  // Check if filename is not empty, then launch preprocessing
  if (fileName) {
    console.log('[Init] Launch preprocess')
    this.preprocessDataframe(modelId)
  }
}

let theme // Theme object
let timeOutAutorun // Timeout for autorun updates

const params = {
  /*
    COMPONENTS
  */
  components: {
    'baklava-editor': EditorComponent,
    'color-picker': VueColor.Swatches,
    'draggable': draggable,
    's-inputs': InputsComponent,
    // 's-flow': FlowComponent,
    's-dialogs': DialogsComponent,
    's-network': NetworkComponent,
    's-sidebar': SidebarComponent,
    's-menu': MenuComponent,
  },

  /*
    DATA
  */
  data: () => ({
    activeModel: 0, // Selected model
    autorun: false, // TODO: Autorun simulation after each change
    baklava: null,
    baklavaGraphs: {}, // Temporary store graphs for Baklava when switching between models
    chooseIconForBlock: -1, // If > 0 icon selector activates
    code: '', // Compiled webppl code
    colors, // Array of block colors
    dialogs: {
      'new-project-dialog': false,
      'remove-model-dialog': false,
    },
    error: '', // Error string, activates error bar
    expressions, // List of expression types with parameters
    icons, // List of icons with codes
    link: '', // Generated URL
    linkParams: {
      preview: true,
      includeDataframes: true,
      sourcesOnly: true,
      dataUrl: false
    },
    loading: false, // Show loading indicator?
    message: '', // Any message in top bar
    models: [], // Array of project models
    networkEvents: "",
    notificationFlag: false, // Show notification?
    notificationText: '',
    preview: false, // Preview mode?
    samples: {}, // Simulation results (returned by process())
    reactiveDataTable: false, // Update data from table reactively?
    server: false, // Server-side processing
    serverAPI: '',
    serverURL: '',
    // showDataTable: false, // Show or not data table?
    sidebarWidth: 300, // Sidebar width
    simulationMethods, // Array of simulation methods
    theme: 'light', // Current theme
    // units: Qty.getUnits().map(u => ({ name: u })), // All units -> BlockData.vue
    version
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
    document.getElementById('app-loader').style.display = 'none'

    // Baklava
    this.baklava = useBaklava();
    nodes.forEach(node => {
      this.baklava.editor.registerNodeType(node)
    })
    // const token = Symbol()
    // this.baklava.editor.nodeEvents.update.subscribe(token, (data, node) => {
    //   // Update outputs
    //   if (this.autorun) {
    //     try {
    //       setTimeout(() => {
    //         this.run()
    //       }, 100)
    //     } catch (e) {
    //       this.log('[Baklava] Error', e)
    //     }
    //   }
    // })

    // Theme
    theme = useTheme()
    theme.global.name.value = this.theme

    // Check if we have a query
    if (window.location.search) {
      let query = window.location.search
      if (query.indexOf('preview') > 0) {
        this.preview = true
      }
      parseLink(
        query,
        ({ models, activeModel }) => {
          this.log('[parseLink] Got models from queries:', models, activeModel)
          processModels(models)
          this.models = models
          this.switchModel(0 || activeModel)
          if (query.indexOf('url=') > 0) {
            console.log('[Vue] Initializing stream for data url')
            // Adding delay here because somewhere else table redraw is initialized
            delay.call(this, 1000, () => {
              this.init(models[0].pipeline.source.url, 0) // We have only one model
            })
          }
        },
        (err) => {
          this.notify(err, 'error')
        }
      )
    } else { // *if window.location.search is not empty
      // Clean start
      this.models = [createBaseModel('Main')]
      this.switchModel(0)
      // delay.call(this, 500, () => {
      //   this.openDialog('onboarding')
      // })
    }
  },
  watch: {
    // whenever model changes, this function will run
    // https://vuejs.org/guide/essentials/watchers.html#this-watch
    // TODO: stop watcher when autorun is off
    /*
    models: {
      handler () {
        if (this.autorun && !this.loading) {
          if (typeof timeOutAutorun !== 'undefined') {
            clearTimeout(timeOutAutorun)
          }
          timeOutAutorun = setTimeout(() => {
            this.log('[Watch] Autorun...')
            this.run()
          }, 1000)
        }
      },
      deep: true
    }
    */
    /* 
    activeModel () {
      this.log('[Watch] Active model changed')
      this.switchModel(this.activeModel)
    }
    */
  },
  methods: {
    // Switch to next model
   scroll () {
      // I temporary disable this hack because of small resize glitch when scrollbar disappears
      // document.body.className = 'md-theme-default'
    },
    noScroll () {
      // document.body.className = 'md-theme-default no-scroll'
    },
    nextModel () {
      this.switchModel((this.activeModel < this.models.length - 1) ? this.activeModel + 1 : 0)
    },
    // Switch to previous model
    previousModel () {
      this.switchModel((this.activeModel > 0) ? this.activeModel - 1 : this.models.length - 1)
    },
    // Switch preview mode according to boolean parameter "b"
    previewMode (b) {
      const app = this
      console.log('[Vue] Switch to preview mode:', b)
      app.preview = b
      // Redraw table if needed
      if (table && !table.isDestroyed && app.models[app.activeModel].modelParams.table) {
        console.log('[Vue] Redrawing table after switching modes')
        delay.call(app, 300, () => {
          table.render()
        })
      }
    },
    togglePreview () {
      this.preview = !this.preview
    },
    init,
    preprocessDataframe,
    previewDataframe,
    processDataframe,
    stopStream (modelId) {
      const app = this
      const model = app.models[app.activeModel]
      app.link = ''

      model.pipeline.source.stream.pause()
      if (model.pipeline.source.stream.destroy) {
        console.log('[Stop stream] Destroying stream')
        model.pipeline.source.stream.destroy()
      }

      if (model.pipeline.output.toMemory) {
        console.log('[Process] Finished, length: ', model.data.length)
        console.log('[Process] First 3 rows: ', [model.data[0], model.data[1], model.data[2]])
        if (model.modelParams.table) {
          console.log('[Process] Render table')
          app.renderDataTable()
        }
      }

      // Indicate that source is not loading anymore
      model.loading = false
      app.notify('Read stream stopped')
    },
    addFilter (modelId) {
      const model = this.models[modelId]
      if (model.pipeline && model.pipeline.filters) {
        model.pipeline.filters.push({
          column: '',
          value: '',
          strict: false,
          casesensitive: false,
          range: false,
          from: 0,
          to: 0
        })
      }
    },
    notify (message, type) {
      // Show bottom notification
      this.notificationText = message
      this.notificationFlag = !this.autorun
    },
    downloadCode () {
      // Download code
      console.log('Vue: Downloading code')
      const blob = new Blob([this.link], {type: 'text/plain;charset=utf-8'})
      let ext = 'txt'
      if (this.link.includes('modelParams')) {
        ext = 'json'
      } else if (this.link.includes('pymc3')) {
        ext = 'py'
      } else if (this.link.includes('return')) {
        ext = 'wppl'
      }
      fileSaver.saveAs(blob, 'model.' + ext)
    },
    copyCode () {
      // Copy code block to the clipboard
      console.log('Vue: Copying to the clipboard')
      copyText(this.link)
      this.notify('Copied to clipboard')
    },
    download () {
      // Download samples
      console.log('Vue: Downloading samples')
      const csv = samplesToCSV(this.samples)
      const blob = new Blob([csv], { type: 'text/plain;charset=utf-8' })
      fileSaver.saveAs(blob, this.models[0].modelParams.name + '-results.csv')
    },
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
      if (!isNaN(parseInt(selection.nodes[0]))) {
        // Scroll to block
        const block = document.getElementById('block-id-' + this.activeModel + '-' + selection.nodes[0])
        const offset = block.offsetTop
        document.getElementById('sidebar').scrollTop = offset - 20
        // Maximize block
        this.models[this.activeModel].blocks[selection.nodes[0]].minimized = false
      }
    },
    chooseIcon (icon) {
      this.$set(this.models[this.activeModel].blocks[this.chooseIconForBlock], 'icon', icon)
      this.$set(this.models[this.activeModel].blocks[this.chooseIconForBlock], 'color', colors[this.models[this.activeModel].blocks[this.chooseIconForBlock].typeCode])
      this.$set(this.models[this.activeModel].blocks[this.chooseIconForBlock], 'size', 40)
      this.chooseIconForBlock = -1
    },
    guessUnits (str, i) {
      this.models[this.activeModel].blocks[i].units = guessUnits(str, this.models[this.activeModel].blocks)
    },
    // Only when using with a regular model, not DF:
    // Update data blocks from a table inner data object
    // Called from renderTable() event function upd() that checks model types
    updateData () {
      // Convert array to a comma-separated string
      function toStringList (arr) {
        // Find last non empty value
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
            if (h && h.length) {
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
    disableDataTable () {
      console.log('[Vue] Disable table')
      const app = this
      const model = app.models[app.activeModel]
      model.modelParams.table = false
      app.removeDataTable()
    },
    removeDataTable () {
      console.log('[Vue] Destroying table')
      if (table && !table.isDestroyed) {
        table.destroy()
      }
    },
    enableDataTable () {
      console.log('[Vue] Show table')
      const app = this
      const model = app.models[app.activeModel]
      model.modelParams.table = true
      app.renderDataTable()
    },
    // Reloads data from DataFrame, re-renders the table
    updateDataTable () {
      const app = this
      const model = app.models[app.activeModel]
      table.loadData(model.data)
      table.render()
    },
    renderDataTable () {
      console.log(`[Render data table] Let's start!`)
      const app = this
      const model = app.models[app.activeModel]

      delay.call(this, 300, () => {
        // Function called on each table update
        function upd () {
          console.log('[Table] Detected changes..')
          if (!(model.modelParams.type && (model.modelParams.type === 'dataframe'))) {
            console.log('[Table] Need manually update model data blocks')
            app.updateData()
          }
        }

        let data = [[null]]

        console.log(`[Render data table] After some delay..`)
        if (model.modelParams.type && model.modelParams.type === 'dataframe' && model.data) {
          // Dataframe
          console.log('[Table] Getting data directly from dataframe')
          data = model.data
        } else {
          // Regular model
          let dataBlocks = model.blocks.filter(b => b.typeCode === 2)
          console.log(`[Table] Getting data from ${dataBlocks.length} datablocks`)

          // Create data array in the table-friendly format
          // First row contain headers
          data = [dataBlocks.map(b => b.name)]

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
        } // *else

        // Fill extra cells 10x10 for better user experience
        let length = Math.max(10, data.length)
        for (let i = 0; i <= length; i++) {
          if (!Array.isArray(data[i])) {
            data[i] = []
          }
          for (let j = 0; j <= 10; j++) {
            if (!data[i][j]) data[i][j] = null
          }
        }

        var container = document.querySelector('.table-wrapper')
        this.log('[renderDataTable] Container: ', container)
        // Clear old table
        container.innerHTML = ''
        // Create a new table
        table = new Table(container, {
          data,
          contextMenu: true,
          /*
          contextMenu: {
            items: {
                    "colors": { // Own custom option
                              name: 'Colors...',
                              submenu: {
                                          // Custom option with submenu of items
                                          items: [
                                            {
                                                            // Key must be in the form "parent_key:child_key"
                                                            key: 'colors:red',
                                                            name: 'Red',
                                                            callback: function(key, selection, clickEvent) {
                                                                              setTimeout(function() {
                                                                                                  alert('You clicked red!');
                                                                                                }, 0);
                                                                            }
                                                          },
                                                        { key: 'colors:green', name: 'Green' },
                                                        { key: 'colors:blue', name: 'Blue' }
                                                      ]
                                        }
                            },
              'export': {
                name: 'Export to CSV',
                callback: function (key, options) {
                  let start = options[0].start
                  let end = options[0].end
                  for (let ri = start.row; ri <= end.row; ri++) {
                    for (let ci = start.col; ci <= end.col; ci++) {
                      data[ri][ci] = 9
                    }
                  }
                  table.render()
                  console.log(key, options)
                  this.getPlugin('exportFile').downloadFile('csv', {
                    filename: 'MyFile'
                  })
                }
              },
              'sep0': {name: '---'},
              'row_above': true,
              'row_below': true,
              'remove_row': true,
              'sep1': {name: '---'},
              'col_left': true,
              'col_right': true,
              'remove_col': true,
              'sep2': {name: '---'},
              'make_read_only': true,
              'alignment': true,
              'undo': true,
              'redo': true
            }
          },
          */
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
          manualColumnResize: true,
          manualColumnMove: true,
          minCols: 10,
          minRows: 30,
          minSpareCols: 0,
          minSpareRows: 1,
          columnSorting: {
            indicator: true,
            headerAction: true
          },
          beforeColumnSort: function (currentSortConfig, destinationSortConfigs) {
            // let data = this.getData()
            const columnSortPlugin = this.getPlugin('columnSorting')
            columnSortPlugin.setSortConfig(destinationSortConfigs)

            let config = destinationSortConfigs[0]
            if (config) {
              let col = config.column
              let order = +(config.sortOrder === 'asc')

              console.log(order)

              console.log(currentSortConfig, destinationSortConfigs)

              let header = model.data.shift(1)
              model.data.sort((a, b) => {
                if ((b[col] === null) || (b[col] === '')) return -1
                let ac = isNaN(a[col]) ? a[col] : +a[col]
                let bc = isNaN(b[col]) ? b[col] : +b[col]
                if (ac < bc) return 1 - 2 * order
                else if (ac > bc) return 2 * order - 1
                else return 0
              })

              model.data.unshift(header)

              console.log(model.data)
              table.render()
            }

            return false // The blockade for the default sort action.
          },
          colHeaders: true,
          rowHeaders: function (index) {
            return (index > 0) ? index : ''
          },
          startCols: 10,
          startRows: 10,
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
    setTheme (newTheme) {
      this.theme = newTheme
      document.cookie = 'theme=' + theme
      theme.global.name.value = newTheme
    },
    toggleTheme () {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    },
    newProject () {
      this.log('Creating a new project...')
      delay.call(this, 300, () => {
        // Switch to edit mode
        this.preview = false
        // Update history
        window.history.replaceState({}, 'New project', '.')
        // Switch to firstModel model
        this.switchModel(0)
        // Clean models
        this.models = [createBaseModel('Main')]
        this.notify('New project created')
      })
    },
    openFile (fileType) {
      document.getElementById(`open${fileType}File`).click()
    },
    openDataFile (e) {
      this.closeDialog('onboarding')
      const reader = new FileReader()
      const file = e.target.files[0]
      const filename = file.name.split('.')[0]
      reader.readAsText(file)
      reader.onload = () => {
        const data = reader.result
        parseCSV(data, {}, (err, output) => {
          if (!err) {
            if (output.length > 1) {
              // CSV

              // Create a new dataframe-model
              let model = createBaseModel(filename, 'dataframe')
              this.models.push(model)

              // Fill it with columns from CSV file
              /*
              // Old solution with blocks
              output[0].forEach((h, hi) => {
                this.models[this.models.length - 1].blocks.push(new BlockClasses[2](
                  h,
                  // Filter out the first line
                  output.filter((_, i) => i > 0).map(v => v[hi])
                ))
              })
              */

              model.data = output.slice(0)
              model.pipeline.source.type = 'file'
              model.pipeline.source.format = 'csv'
              model.pipeline.source.fileList = e.target.files
              model.pipeline.source.file = file.name
              model.pipeline.source.columns = output[0]
              model.pipeline.processed = file.size
              model.pipeline.progress = 100
              model.pipeline.parse.delimiter = ','

              // Switch to new model
              this.switchModel(this.models.length - 1)
            } else {
              // Comma-separated line
              this.models[this.activeModel].blocks.push(new BlockClasses[2](file.name.split('.')[0], output))
            }
            // Update table
            this.renderDataTable()
          } else {
            console.log(err)
          }
        })
      }
    },
    openProjectFile (e) {
      // this.closeDialog('onboarding')
      const reader = new FileReader()
      const file = e.target.files[0]
      reader.readAsText(file)
      reader.onload = () => {
        const models = JSON.parse(reader.result)
        processModels(models) // Apply some fixes to the models before loading
        this.log('[openProjectFile] Opening a project:')
        this.log(JSON.stringify(models, null, 2))
        delay.call(this, 500, () => {
          window.history.replaceState({}, 'New project', '.')
          // Why here, not after update?
          // this.switchModel(0)
          this.models = Array.isArray(models) ? models : [models]
          this.switchModel(0, true)
          // this.fitNetwork()
        })
      }
    },
    saveProject () {
      // Store current model nodes positions
      const currentModel = this.models[this.activeModel]
      if (currentModel.modelParams.type && (currentModel.modelParams.type === 'flow')) {
        // If flow: 
        // Convert current flow to blocks
        // Coordinates are stored in block.posFlow.x, .y
        const flow = this.baklava.editor.save()
        const blocks = flowToBlocks(flow, this.log)
        currentModel.blocks = blocks
      } else {
        // If blocks: 
        // Store current positions from the graph
        const positions = this.getPositions(false)
        currentModel.blocks.forEach((b, bi) => {
          b.pos = positions[bi]
        })
      }
      const blob = new Blob([JSON.stringify(cleanModels(this.models), null, 2)], {type: 'text/plain;charset=utf-8'})
      fileSaver.saveAs(blob, this.models[0].modelParams.name + '.json')
    },
    // Open remove model dialog
    openDialog (dialogName) {
      this.dialogs[dialogName] = true
    },
    closeDialog (dialogName) {
      this.dialogs[dialogName] = false
    },
    createModel () {
      const index = 1 + this.models.filter(m => !(m.modelParams.type && (m.modelParams.type === 'dataframe'))).length
      this.models.push(createBaseModel('Model' + index))
      this.switchModel(this.models.length - 1)
      this.notify('New model created')
    },
    createTFModel () {
      const index = 1 + this.models.filter(m => !(m.modelParams.type && (m.modelParams.type === 'dataframe'))).length
      this.models.push(createBaseModel('Model' + index, 'tf'))
      this.switchModel(this.models.length - 1)
      this.notify('New TF model created')
    },
    createDataframe () {
      const index = 1 + this.models.filter(m => (m.modelParams.type && (m.modelParams.type === 'dataframe'))).length
      this.models.push(createBaseModel('Data' + index, 'dataframe'))
      this.switchModel(this.models.length - 1)
      this.renderDataTable()
      this.notify('New dataframe created')
    },
    switchModel (modelId, ignoreCurrentModel = false) {
      this.log('[switchModel] Switching to model', modelId)
      this.samples = {} // Clear old samples
      this.error = ''
      if (modelId < 0 || modelId > this.models.length - 1) {
        this.notify('Invalid model number. Switching to first model', 'error')
        modelId = 0
      }

      // Get current model
      const currentModel = ignoreCurrentModel 
        ? undefined
        : this.models[this.activeModel]

      // Get target model
      const targetModel = this.models[modelId]

      this.link = '' // clean code
      this.message = ''

      // if (currentModel.modelParams.type && (currentModel.modelParams.type === 'dataframe')) {
      //   // Current: Dataframe
      // } else {
      //   // Current: Model

      //   // Get current positions of the graph and save them
      //   // if (this.$refs.network) {
      //   //   currentModel.blocks.forEach((b, bi) => {
      //   //     console.log('Network: get pos')
      //   //     b.pos = this.$refs.network.getPositions([bi])[bi]
      //   //   })
      //   // }
      // }

      if (targetModel.modelParams.type && (targetModel.modelParams.type === 'dataframe')) {
        // Target: Dataframe
      } else {
        // Target: Model or Flow
        targetModel.blocks.forEach(b => {
          b.minimized = true
        })
      }
      
      // Switch flow (current flow -> ...)
      const isCurrentModelFlow = currentModel && currentModel.modelParams.type && (currentModel.modelParams.type === 'flow')
      if (isCurrentModelFlow) {
        // Save current flow
        this.log('[switchModel] Saving current flow...')
        const flow = this.baklava.editor.save()
        this.baklavaGraphs[this.activeModel] = flow
        // Update model blocks
        currentModel.blocks = flowToBlocks(flow, this.log)
        // Disable preview when switching from flow (can be re-enabled later in the next if branch)
        this.preview = false
      }

      // Switch flow (... -> target flow)
      const isTargetModelFlow = targetModel.modelParams.type && (targetModel.modelParams.type === 'flow')
      if (isTargetModelFlow) {
        if (this.baklavaGraphs[modelId]) {
          this.log('[switchModel] Loading flow from cache...')
          this.baklava.editor.load(this.baklavaGraphs[modelId])
        } else {
          this.log('[switchModel] Loading flow from blocks...')
          const flow = blocksToFlow(
            targetModel.blocks, 
            this.log
          )
          this.baklava.editor.load(flow)
        }
        // Enable preview when switching to flow
        this.preview = true
      }

      // Change activeModel index to target model
      this.activeModel = modelId

      // Update table if needed
      if (targetModel.modelParams.table) {
        this.renderDataTable()
      } else {
        this.removeDataTable()
      }
    },
    duplicateModel () {
      let newModel = JSON.parse(JSON.stringify(this.models[this.activeModel]))
      newModel.modelParams.name += 'Copy'
      this.models.push(newModel)
      this.notify('New model created (duplicate)')
    },
    removeModelConfirmed (confirm) {
      if (confirm === 'ok') {
        console.log('[Vue] Confirmed to remove model: ', modelToRemove)
        let i = modelToRemove
        // Check if we are removing active model
        if (i === this.activeModel) this.switchModel((i > 0) ? i - 1 : 0)
        // Check if it's a model before active
        if (i < this.activeModel) this.switchModel(this.activeModel - 1)
        // Remove model
        this.log('Active model: ', this.activeModel)
        this.log('Removing model: ', i)
        setTimeout(() => {
          this.models.splice(i, 1)
        }, 1)
      }
    },
    // That's just a wrapper for dialog and removeModelConfirmed()
    removeModel (modelId) {
      modelToRemove = modelId || this.activeModel
      this.openDialog('remove-model-dialog')
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
        this.link = beautify(this.code, { indent_size: 2 })
        this.notify('Compiled to WebPPL')
      })
    },
    generateTFJS () {
      delay.call(this, 1000, () => {
        this.compile('tfjs')
        this.link = beautify(this.code, { indent_size: 2 })
        this.notify('Compiled to TFJS')
      })
    },
    generatePYMC3 () {
      delay.call(this, 1000, () => {
        this.compile('pymc3')
        this.link = this.code
        this.notify('Compiled to PyMC3')
      })
    },
    generateTFP () {
      delay.call(this, 1000, () => {
        this.compile('tfp')
        this.link = this.code
      })
    },
    generateZ3 () {
      delay.call(this, 1000, () => {
        this.compile('z3')
        this.link = this.code
      })
    },
    generateLink () {
      delay.call(this, 400, () => {
        this.link = createLink(cleanModels(this.models), this.activeModel, this.linkParams)
        this.notify('Link generated')
      })
    },
    generateJSON () {
      delay.call(this, 600, () => {
        this.link = JSON.stringify(cleanModels(this.models), null, 2) // indent with 2 spaces
        this.notify('JSON generated')
      })
    },
    toggleBlock (blockIndex) {
      const oldMinimized = this.models[this.activeModel].blocks[blockIndex].minimized
      this.models[this.activeModel].blocks[blockIndex].minimized = !oldMinimized
    },
    maximizeAllBlocks () {
      this.$refs.sidebar.maximizeAllBlocks()
    },
    minimizeAllBlocks () {
      this.$refs.sidebar.minimizeAllBlocks()
    },
    compile (target) {
      // Convert available models (this.models) to the probabilistic lang
      if (!target || (target === 'wppl')) {
        this.code = compileModels(this.models, this.activeModel)
      } else if (target === 'pymc3') {
        this.code = compilePYMC3(this.models, this.activeModel)
      } else if (target === 'tfp') {
        this.code = compileTFP(this.models, this.activeModel)
      } else if (target === 'tfjs') {
        this.code = compileTFJS(this.models, this.activeModel)
      } else {
        this.code = compileZ3(this.models, this.activeModel)
      }
      console.log('Vue: F* yeah! Got compiled code!')
    },
    toggleFlow (model) {
      const X_SCALE = 2
      const X_OFFSET = 350
      const Y_SCALE = 4.5
      const Y_OFFSET = 0

      if (typeof model === 'undefined') {
        model = this.models[this.activeModel]
      }
      if (model.modelParams.type === undefined) {
        model.modelParams.type = 'blocks'
      }
      if (model.modelParams.type === 'flow') {
        this.log('[toggleFlow] Converting to blocks')
        const flow = this.baklava.editor.save()
        console.log('[toggleFlow] Current flow:', JSON.stringify(flow, null, 2))
        const blocks = flowToBlocks(flow, this.log)
        // Initialize graph positions
        // They will be removed when the graph is updated
        for (let i = 0; i < blocks.length; i++) {
          let block = blocks[i]
          if (block.hasOwnProperty('posFlow')) {
            block.pos = {
              x: block.posFlow.x / X_SCALE - X_OFFSET,
              y: block.posFlow.y / Y_SCALE - Y_OFFSET
            }
          } else {
            block.pos = { 
              x: 0, 
              y: 0 
            }
          }
        }
        model.blocks = blocks
        console.log('[toggleFlow] New blocks:', JSON.stringify(blocks, null, 2))
        model.modelParams.type = 'blocks'
        this.preview = false
      } else {
        this.log('[toggleFlow] Converting to flow')
        // Generate new positions using hierarchical layout and indexing by x and y
        const positions = this.getPositions(true)
        const xArray = positions.map(p => p.x)
        const yArray = positions.map(p => p.y)
        const xUnique = Array.from(new Set(xArray)).sort((a, b) => a - b)
        const yUnique = Array.from(new Set(yArray)).sort((a, b) => a - b)
        const positionsNew = positions.map(p => { 
          return {
            x: xUnique.indexOf(p.x) * 350,
            y: yUnique.indexOf(p.y) * 450
          }
        })
        
        console.log('[toggleFlow] New positions:', positionsNew)
        this.models[this.activeModel].blocks.forEach((block, i) => {
          if (!block.hasOwnProperty('posFlow')) {
            block.posFlow = {
              //x: X_OFFSET + positionsNew[i].x * X_SCALE,
              //y: Y_OFFSET + positionsNew[i].y * Y_SCALE
              x: positionsNew[i].x,
              y: positionsNew[i].y
            }
          }
        })
        const flow = blocksToFlow(
          this.models[this.activeModel].blocks, 
          this.log
        )
        this.baklava.editor.load(flow)
        model.modelParams.type = 'flow'
        this.preview = true
      }
    },
    getPositions (hierarchical=false) {
      const positions = this.$refs.network.getPositions(hierarchical) // -> Object
      return Object.keys(positions).map(k => {
        // Check if current block has positions `pos`
        if (this.models[this.activeModel].blocks[k].hasOwnProperty('pos')) {
          // If so, return the positions from the block
          return this.models[this.activeModel].blocks[k].pos
        } else {
          // Otherwise, return the positions from the network
          return positions[k]
        }
      })
    },
    updateBlockPosition (id, pos) {
      this.models[this.activeModel].blocks[id].pos = pos
    },
    log() {
      console.log('[App]', ...arguments)
    },
    process (data) {
      this.loading = false
      document.getElementById('loader').className = 'hidden'
      this.log('Process results:', data)
      this.samples = processResults(data, this.models[this.activeModel].blocks, this.models[this.activeModel].modelParams)
      // Update values in the blocks
      Object.keys(this.samples).forEach((key) => {
        const samplesCurrent = this.samples[key]
        const block = this.models[this.activeModel].blocks.find(b => b.name.replace(/ /g, '__') === key)
        if (typeof block === 'undefined') {
          return
        } else if (typeof samplesCurrent === 'number') {
          block.value = samplesCurrent.toFixed(2)
        } else if (Array.isArray(samplesCurrent)) {
          if (samplesCurrent.length === 1) {
            block.value = samplesCurrent[0].toFixed(2)
          } else {
            const mean = Stats.Mean()(samplesCurrent)
            const std = Stats.Std()(samplesCurrent)
            block.value = `${mean.toFixed(2)} ± ${std.toFixed(2)}`
          }
        }
      })
      this.notify('Done!')
    },
    run () {
      const app = this
      const model = app.models[app.activeModel]

      // Check if current model is flow-based
      // In such case the blocks are out of sync with the flow
      // Convert flow to blocks, but do not switch
      if (model.modelParams.type === 'flow') {
        this.log('[run] Generating blocks from flow model')
        const flow = this.baklava.editor.save()
        model.blocks = flowToBlocks(flow, this.log)
      }

      const errorHandler = (err) => {
        this.loading = false
        document.getElementById('loader').className = 'hidden'
        this.notify(err.message, 'error')
      }

      document.querySelector('.charts').innerHTML = ''
      document.querySelector('.charts-2d').innerHTML = ''
      document.querySelector('.charts-extra').innerHTML = ''
      document.querySelector('.archives').innerHTML = ''
      document.getElementById('loader').className = ''

      this.samples = {} // clear samples
      this.loading = true
      this.link = ''
      this.message = ''
      this.error = ''

      document.cookie = 'url=' + this.serverURL
      document.cookie = 'api=' + this.serverAPI
      document.cookie = 'server=' + this.server

      if (model.modelParams.type === 'tf') {
        app.compile('tfjs')
      } else if (model.modelParams.method === 'smt') {
        app.compile('z3')
        console.log('[Vue] Compiled to SMT:', app.code)
      } else {
        app.compile()
      }

      // Add some delay to finish display update
      setTimeout(() => {
        try {
          // Precheck models
          if (!(
            this.models[this.activeModel].blocks.length ||
            (this.models[this.activeModel].modelParams.customCode && this.models[this.activeModel].modelParams.customCode.length)
          )) {
            throw new Error('Empty model! Click ADD BLOCK to start designing the model!')
          }
          if (!(
            this.models[this.activeModel].blocks.reduce((acc, b) => acc || b.show, false) ||
            (this.models[this.activeModel].modelParams.method === 'smt') ||
            (this.models[this.activeModel].modelParams.customCode && this.models[this.activeModel].modelParams.customCode.includes('return'))
          )) {
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
                  let w
                  if (model.modelParams.method === 'smt') {
                    // Z3 worker
                    w = new Worker('worker-z3.js')
                  } else {
                    // WebPPL worker
                    w = new Worker('worker-wppl.js')
                  }
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

// module.exports = params
export default params
