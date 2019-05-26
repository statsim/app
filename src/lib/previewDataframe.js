const parseStream = require('./parseStream')
const splitStream = require('./splitStream')
const isExactlyNaN = require('./isExactlyNaN')

/*
  PREVIEW SOURCE
*/
module.exports = function preview (modelId) {
  console.log('[Preview] Got model!')
  const app = this
  const model = app.models[app.activeModel]

  app.set(model, 'data', [])

  model.preview = true

  // Detect correct columns
  let columns = (model.pipeline.structure.showAll || !model.pipeline.structure)
    ? model.pipeline.source.columns
    : model.pipeline.structure.columns

  let counter = 0

  if (model.modelParams.table) {
    console.log('[Process] Render table')
    app.renderDataTable()
  }

  // We need extra stream (previewStream) to be able pause/resume it.
  // If we just pause readable stream that is piped to transform streams,
  // it will miss huge buffer chunks
  const previewStream = model.pipeline.source.stream
    .pipe(splitStream(model.pipeline.source.format, ''), { end: false }) // Split text stream into text blocks (one for each record)
    .pipe(parseStream(model.pipeline.source.format, {
      header: model.pipeline.source.columns, // Send false if we load header from file, array of column names otherwise
      delimiter: model.pipeline.parse.delimiter,
      comment: model.pipeline.parse.comment
    }), { end: false }) // 'end' <boolean> End the writer when the reader ends. Defaults to true
  /*
    .pipe(flatObjectStream(), { end: false })
*/

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
    if (counter < 49) {
      counter += 1
    } else {
      console.log('[Preview] Pausing stream')
      previewStream.pause()
      app.updateDataTable()
    }
  })

  model.pipeline.source.stream.on('end', () => {
    console.log('[Preview] Stream ended, update the table with values')
    model.preview = false
    app.updateDataTable()
  })

  app.notify('Preview mode...')
}
