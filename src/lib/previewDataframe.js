/*
  PREVIEW SOURCE
*/
module.exports = function preview (modelId) {
  log('[Preview] Got model!')
  const app = this
  const model = app.models[app.activeModel]

  if (model.modelParams.table) {
    console.log('[Process] Render table')
    app.renderDataTable()
  }

  // We need extra stream (previewStream) to be able pause/resume it.
  // If we just pause readable stream that is piped to transform streams,
  // it will miss huge buffer chunks
  model.pipeline.source.stream = model.pipeline.source.stream
    .pipe(splitStream(source.type, source.item), { end: false }) // Split text stream into text blocks (one for each record)
    .pipe(parseStream(source.type, {
      header: (!source.params.isHeader) && source.columns, // Send false if we load header from file, array of column names otherwise
      delimiter: source.params.delimiter,
      comment: source.params.comment
    }), { end: false }) // 'end' <boolean> End the writer when the reader ends. Defaults to true
    .pipe(flatObjectStream(), { end: false })

  source.previewStream.on('data', function (obj) {
    // If stream sends data read it anyway. Not to miss between line
    console.log(obj)
    let line = []
    for (let prop in obj) {
      line[collection.columns.indexOf(prop)] = obj[prop]
    }
    collection.values.push(line)
    collection.length += 1

    // Check counter
    if (source.counter < 49) {
      source.counter += 1
    } else {
      ht.loadData(collection.values)
      ht.render()
      source.previewStream.pause()
    }
  })

  source.stream.on('end', () => {
    log('[Preview] Stream ended, update the table with values:', collection.values)
    ht.loadData(collection.values)
    ht.render()
  })

  app.notify('Preview opened. Scroll to load more...')
}

