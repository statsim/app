const parseStream = require('./parseStream')
const splitStream = require('./splitStream')
const isExactlyNaN = require('./isExactlyNaN')
const createStream = require('./createStream')
const flatObjectStream = require('./flatObjectStream')

/*
  PREVIEW SOURCE
*/
module.exports = async function preview (modelId) {
  const app = this
  const model = app.models[modelId]

  console.log('[Preview] Preview dataframe:', model.modelParams.name)

  app.set(model, 'data', [])

  // Detect correct columns
  let columns = (model.pipeline.structure.showAll || !model.pipeline.structure)
    ? model.pipeline.source.columns
    : model.pipeline.structure.columns

  let counter = 0

  if (model.modelParams.table) {
    console.log('[Preview] Render table')
    app.renderDataTable()
  }

  let stream

  try {
    if ((model.pipeline.source.type === 'file') && model.pipeline.source.file) {
      stream = await createStream(model.pipeline.source.fileList[0])
    } else if ((model.pipeline.source.type === 'url') && model.pipeline.source.url && model.pipeline.source.url.length) {
      stream = await createStream(model.pipeline.source.url)
    } else if ((model.pipeline.source.type === 'dataframe') && (model.pipeline.source.dataframe !== '')) {
      stream = await createStream(app.models[model.pipeline.source.dataframe])
    } else {
      console.log('[Process] No sources provided')
    }
  } catch (e) {
    this.notify(e.message, 'error')
  }

  // We need extra stream (previewStream) to be able pause/resume it.
  // If we just pause readable stream that is piped to transform streams,
  // it will miss huge buffer chunks
  let previewStream = stream
    .pipe(splitStream(model.pipeline.source.format, ''), { end: false }) // Split text stream into text blocks (one for each record)
    .pipe(parseStream(model.pipeline.source.format, {
      header: model.pipeline.source.columns, // Send false if we load header from file, array of column names otherwise
      delimiter: model.pipeline.parse.delimiter,
      comment: model.pipeline.parse.comment
    }), { end: false }) // 'end' <boolean> End the writer when the reader ends. Defaults to true

  // Flat XML tree-like objects
  if (model.pipeline.source.format === 'xml') {
    previewStream = previewStream.pipe(flatObjectStream(), { end: false })
  }

  previewStream.on('data', function (obj) {
    // If stream sends data read it anyway. Not to miss between line
    let line = []
    for (let prop in obj) {
      // The only value that will be converted to '' is NaN
      const value = (!isExactlyNaN(obj[prop])) ? obj[prop] : ''
      // blocks[prop].value += (blocks[prop].value.length ? ',' : '') + value + ''
      line[columns.indexOf(prop)] = value
    }
    model.data.push(line)

    // Check counter
    if (counter < 50) {
      counter += 1
    } else {
      model.preview = true
      app.notify(`Loaded only ${counter} records`)
      console.log('[Preview] Pausing stream')
      previewStream.pause()
      app.updateDataTable()
    }
  })

  stream.on('end', () => {
    app.notify(`Loaded all records`)
    console.log('[Preview] Stream ended, update the table with values')
    app.updateDataTable()
  })
}
