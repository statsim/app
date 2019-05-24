const filter = require('stream-filter') // Filter string and obj streams
const through2 = require('through2') // Transform stream
const StreamSaver = require('streamsaver') // Creates write stream to generate files
const J2SParser = require('json2csv').Parser // Convert array of objects to CSV
const X2JParser = new (require('xml2js')).Builder({'pretty': false, 'indent': '', 'newline': ''})
const flat = require('flat')

const BlockClasses = require('./blockClasses')
const createStream = require('./createStream')
const parseStream = require('./parseStream')
const splitStream = require('./splitStream')
const isExactlyNaN = require('./isExactlyNaN')

const encoder = new window['TextEncoder']()

// --> Transform -->
// Filter text string (array of values to find)
function filterTextStream (searchArr, fileType, casesensitive) {
  let header = true
  return filter((line) => {
    let l = searchArr.length
    let found = (l === 0)
    let i = 0
    if ((header) && (fileType === 'csv')) {
      header = false
      return true
    }
    while ((!found) && (i < l)) {
      found = found || (casesensitive && (line.indexOf(searchArr[i]) >= 0)) || (!casesensitive && ((line + '').toLowerCase().indexOf(searchArr[i].toLowerCase()) >= 0))
      i += 1
    }
    return found
  })
}

// --> Transform -->
// Filter object stream (range)
function flatObjectStream () {
  return through2.obj(function (obj, enc, callback) {
    this.push(flat(obj))
    callback()
  })
}

// --> Transform -->
// Filter object stream (array of values to find)
function filterObjectStream (searchArr, searchColumn, strictSearch, casesensitive) {
  return filter.obj((obj) => {
    const l = searchArr.length
    // const value = path.get(obj, searchColumn)
    const value = (casesensitive) ? obj[searchColumn] : obj[searchColumn].toLowerCase() // path.get produced errors when working with folumns that contained '.'
    let found = (l === 0)
    let i = 0
    while ((!found) && (i < l)) {
      const searchValue = (casesensitive) ? searchArr[i] : searchArr[i].toLowerCase()
      found = found || ((strictSearch === true) && (value === searchValue)) || ((strictSearch === false) && (value.indexOf(searchValue) >= 0))
      i += 1
    }
    return found
  })
}

// --> Transform -->
// Filter object stream (range)
function filterObjectStreamByRange (from, to, searchColumn) {
  return filter.obj((obj) => {
    // const value = parseFloat(path.get(obj, searchColumn))
    const value = parseFloat(obj[searchColumn])
    const f = parseFloat(from)
    const t = parseFloat(to)
    return (t <= f) || ((value >= f) && (value <= t))
  })
}

// --> Transform -->
// Restructure flat object stream
function restructureObjectStream (newColumns, showAllColumns) {
  return through2.obj(function (obj, enc, callback) {
    if ((newColumns.length > 0) && (!showAllColumns)) {
      const newObj = {}
      newColumns.forEach((column) => {
        // path.set(structuredObj, column, path.get(obj, el))
        newObj[column] = obj[column]
      })
      this.push(newObj)
    } else {
      this.push(obj)
    }
    callback()
  })
}

module.exports = async function processDataframe (modelId) {
  let app = this
  let model = app.models[modelId]

  console.log('[Process] Processing dataframe: ', model.modelParams.name)

  // Reset dataframe blocks
  // model.blocks = []
  app.set(model, 'blocks', [])
  // model.data = []
  app.set(model, 'data', [])
  model.loading = true
  model.pipeline.progress = 0
  model.pipeline.processed = 0

  // Detect correct columns
  let columns = (model.pipeline.structure.showAll || !model.pipeline.structure)
    ? model.pipeline.source.columns
    : model.pipeline.structure.columns

  console.log('[Process] Columns: ', columns)

  // Create new blocks
  /*
  let blocks = {}
  columns.forEach((c) => {
    let block = new BlockClasses[2](c)
    model.blocks.push(block)
    blocks[c] = block
  })
  */
  // source.loading = true // Currently stream is loading
  // source.progress = 0 // Nullify the progress
  // source.processed = 0 // Nullify the processed byte counter

  // Prepare write stream if needed
  let writer
  if (model.pipeline.output.toStream) {
    const name = model.modelParams.name.split('.').slice(0, -1).join('.') + '.' + model.pipeline.output.format
    const header = (model.pipeline.output.format === 'csv') ? columns.join(',') + '\n' : ''
    console.log('[Process] Initializing file writer:', name)
    const ws = StreamSaver.createWriteStream(name)
    writer = ws.getWriter()
    writer.write(encoder.encode(header))
  }

  // Create a new readable stream
  let stream
  let byteStep
  let size

  try {
    if ((model.pipeline.source.type === 'file') && model.pipeline.source.file) {
      // Stream from file
      console.log('[Process] Local file source:', model.pipeline.source.file)
      stream = await createStream(model.pipeline.source.fileList[0])
      size = model.pipeline.source.fileList[0].size
      console.log('[Processor] Size:', size)
      byteStep = (size < 100000000) ? size / 500 : 200000
      console.log('[Processor] Byte step:', byteStep)
    } else if ((model.pipeline.source.type === 'url') && model.pipeline.source.url && model.pipeline.source.url.length) {
      // Stream from URL
      console.log('[Process] Url source:', model.pipeline.source.url)
      stream = await createStream(model.pipeline.source.url)
      byteStep = 1024
    } else if ((model.pipeline.source.type === 'dataframe') && (model.pipeline.source.dataframe !== '')) {
      // Stream from Dataframe
      console.log('[Process] Dataframe source:', model.pipeline.source.dataframe)
      stream = await createStream(app.models[model.pipeline.source.dataframe])
    } else {
      console.log('[Process] No sources provided')
    }
  } catch (e) {
    this.notify(e.message, 'error')
  }

  // Make link to stream in a pipeline to stop it if needed
  model.pipeline.source.stream = stream

  // Create main stream, calculate progress, split on pieces
  let mainStream = stream
    .pipe(through2(function (chunk, enc, callback) {
      model.pipeline.processed += chunk.length
      if (size) {
        let prevBytes = 0
        if ((model.pipeline.processed - prevBytes) > byteStep) {
          model.pipeline.progress = ((model.pipeline.processed / size) * 100).toFixed(1)
          prevBytes = model.pipeline.processed
        }
      }
      this.push(chunk)
      callback()
    }), { end: false })
    .pipe(splitStream(model.pipeline.source.format, '' /* XML item */), { end: false }) // Split text stream into text blocks (one for each record)

  // -> Hard filters ->
  model.pipeline.filters.forEach(filter => {
    if (!filter.range && filter.value.length) {
      filter.valueArr = filter.value.split(',').map((el) => el.trim())
      mainStream = mainStream
        .pipe(filterTextStream(filter.valueArr, model.pipeline.source.format, filter.casesensitive), { end: false }) // Filter text blocks if needed
    }
  })

  // Parsing
  mainStream = mainStream
    .pipe(parseStream(model.pipeline.source.format, {
      // header: (model.pipeline.parse.hasHeader) ? undefined : model.pipeline.source.columns, // Send false if we load header from file, array of column names otherwise
      header: model.pipeline.source.columns, // Send false if we load header from file, array of column names otherwise
      delimiter: model.pipeline.parse.delimiter,
      comment: model.pipeline.parse.comment
    }), { end: false }) // 'end' <boolean> End the writer when the reader ends. Defaults to true

  // Flat XML tree-like objects
  if (model.pipeline.source.format === 'xml') {
    mainStream = mainStream.pipe(flatObjectStream(), { end: false })
  }

  // Soft filters
  model.pipeline.filters.forEach(filter => {
    if (!filter.range && filter.value.length && filter.column.length) {
      mainStream = mainStream
        .pipe(filterObjectStream(filter.valueArr, filter.column, filter.strict, filter.casesensitive), { end: false })
    } else if (filter.range) {
      mainStream = mainStream
        .pipe(filterObjectStreamByRange(filter.from, filter.to, filter.column), { end: false })
    }
  })

  /*
  // Functions
  // Each function object: {type: 'max', params: {inputColumns: [String], outputColumn: String, outputName: String}}
  source.pipeline.functions.forEach(func => {
    if (func.params.outputColumn || func.params.sameColumn) {
      // Transform or Map
      func.params.outputColumn = (func.params.sameColumn) ? func.params.inputColumn : func.params.outputColumn
      source.mainStream = source.mainStream.pipe(functionStream(func.type, func.params)) // no cb. just map/transform stream
    } else {
      // Reducer
      const res = {name: func.name}
      collection.results.push(res)
      source.mainStream = source.mainStream.pipe(functionStream(func.type, func.params, (result) => {
        if (typeof result === 'object') {
          res.records = result
        } else {
          res.value = result
        }
      }))
    }
  })
  */

  // Restructure
  mainStream = mainStream
    .pipe(restructureObjectStream(model.pipeline.structure.columns, model.pipeline.structure.showAll), { end: false })

  // Stream to file (Chrome & Opera)
  if (model.pipeline.output.toStream) {
    mainStream = mainStream
      .pipe(
        through2.obj(
          function (obj, enc, callback) {
            let piece
            if (model.pipeline.output.format === 'csv') {
              const j2sp = new J2SParser({
                fields: columns,
                header: false
              })
              piece = j2sp.parse(obj)
            } else if (model.pipeline.output.format === 'json') {
              piece = JSON.stringify(obj)
            } else {
              piece = X2JParser.buildObject(obj)
            }

            writer.write(encoder.encode(piece + '\n')).then(() => {
              this.push(obj)
              callback()
            })
          }
        ),
        { end: false }
      )
  }

  // Manual processing
  mainStream.on('data', function (obj) {
    // console.log('[Stream] Line: ', obj)
    // Here the pipeline throws parsed, filtered, not flat objects
    // Plot stream
    /*
    if (app.plotStream.display) {
      ctx.fillStyle = '#000'
      var x = parseFloat(path.get(obj, app.plotStream.data.xColumn)) * (app.plotStream.xSize / (app.plotStream.data.xRange.max - app.plotStream.data.xRange.min)) - app.plotStream.data.xRange.min
      var y = app.plotStream.ySize - (parseFloat(path.get(obj, app.plotStream.data.yColumn)) * (app.plotStream.ySize / (app.plotStream.data.yRange.max - app.plotStream.data.yRange.min)) - app.plotStream.data.yRange.min)
      ctx.fillRect(x, y, 2, 2)
    }
    */
    // Store object in the main collection

    // Drop first row if header exists
    // if ((N && model.pipeline.parse.hasHeader) || (!model.pipeline.parse.hasHeader)) {
    // Check if we need to store results
    // if (true || source.pipeline.charts.length || source.pipeline.output.toTable || source.pipeline.output.toMemory) {
    // {
      const flatObj = flat(obj)
      let line = []
      for (let prop in flatObj) {
        // The only value that will be converted to '' is NaN
        const value = (!isExactlyNaN(flatObj[prop])) ? flatObj[prop] : ''
        // blocks[prop].value += (blocks[prop].value.length ? ',' : '') + value + ''
        line[columns.indexOf(prop)] = value
      }
      model.data.push(line)
      // model.length += 1
    // }
    // }
    // N += 1
  })

  stream.on('end', () => {
    // Finalize collection
    app.link = ''
    if (model.pipeline.output.toMemory) {
      console.log('[Process] Finished, length: ', model.data.length)
      console.log('[Process] First 3 rows: ', [model.data[0], model.data[1], model.data[2]])
      if (model.modelParams.table) {
        console.log('[Process] Render table')
        app.renderDataTable()
      }
    }

    // Finalize output file stream
    if (model.pipeline.output.toStream) {
      console.log('[Process] Closing file writer')
      setTimeout(() => {
        writer.close()
      }, 500)
    }

    console.log('[Process] Stream end!')
    app.notify('Done')
    // Indicate that source is not loading anymore
    model.loading = false
  })
} // *process()
