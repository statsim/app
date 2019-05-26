const getCsvStreamStructure = require('./get-csv-stream-structure.js') // Get CSV header
const createStream = require('./createStream')

// Calculates data header/structure
function getStreamStructure (rs, type, extra) {
  return new Promise((resolve, reject) => {
    if (type === 'csv') {
      getCsvStreamStructure(rs, extra, function (columns, delimiter) {
        resolve({columns, delimiter})
      })
    } /* else if (type === 'xml') {
      getXmlStreamStructure(rs, extra, function (columns, item) {
        resolve({columns, item})
      })
    } */
  })
}

/*
  PREPROCESS:
  1. Generate sources
  2. Initialize sources
  3. Start preview(source) or process(source) for each source
*/
module.exports = async function preprocessDataframe (modelId) {
  const app = this
  const model = app.models[modelId]

  // Show table
  // document.getElementById('hottable').style.display = 'block'

  // Create array of sources objects
  let stream
  try {
    if ((model.pipeline.source.type === 'file') && model.pipeline.source.file) {
      // Stream from file
      console.log('[Preprocess] Local file source:', model.pipeline.source.file)
      stream = await createStream(model.pipeline.source.fileList[0])
    } else if ((model.pipeline.source.type === 'url') && model.pipeline.source.url && model.pipeline.source.url.length) {
      // Stream from URL
      console.log('[Preprocess] Url source:', model.pipeline.source.url)
      stream = await createStream(model.pipeline.source.url)
    } else if ((model.pipeline.source.type === 'dataframe') && (model.pipeline.source.dataframe !== '')) {
      // Stream from Dataframe
      console.log('[Preprocess] Dataframe source:', model.pipeline.source.dataframe)
      // stream = await createStream(app.models[model.pipeline.source.dataframe])
    } else {
      console.log('[Preprocess] No sources provided')
    }
  } catch (e) {
    this.notify(e.message, 'error')
  }

  console.log('[Preprocess] Created stream: ', stream)

  model.pipeline.source.stream = stream

  // Init structure object
  let structure

  if (model.pipeline.source.type === 'dataframe') {
    model.pipeline.source.columns = app.models[model.pipeline.source.dataframe].data[0].slice(0)
    console.log('[Preprocess] Source columns (from dataframe):', model.pipeline.source.columns)
  } else if (model.pipeline.source.format === 'csv') {
    // Guessing CSV source stream structure
    // Detect header (columns) and extra params
    // Returns {columns: [], delimiter: ''} or in case of XML {columns: [], item: ''}

    structure = await getStreamStructure(
      stream,
      model.pipeline.source.format,
      model.pipeline.parse.delimiter // Send predefined delimiter (if exist) as an extra parameter
    )

    console.log('[Preprocess] Source structure:', structure)

    // Set header
    if (model.pipeline.parse.hasHeader) {
      // Load header from file
      model.pipeline.source.columns = structure.columns.slice(0)
    } else {
      // Generate A->Z header
      model.pipeline.source.columns = structure.columns.map((c, ci) => String.fromCharCode(65 + ci))
    }

    // Try custom header, use columns from file if needed
    const customColumns = (model.pipeline.parse.customHeader && model.pipeline.parse.customHeader.length)
      ? model.pipeline.parse.customHeader.split(',').map(s => s.trim())
      : []
    model.pipeline.source.columns = model.pipeline.source.columns.map((c, ci) => {
      return (typeof customColumns[ci] === 'undefined') ? c : customColumns[ci]
    })

    console.log('[Preprocess] Columns: ', model.pipeline.source.columns)

    // Set delimiter if needed
    if (!model.pipeline.parse.delimiter || !model.pipeline.parse.delimiter.length) {
      model.pipeline.parse.delimiter = structure.delimiter
    }
  }

  /*
  else if (source.type === 'xml') {
    // XML

    // Guessing XML source stream structure
    // Returns {columns: [], item: ''}
    if (app.sourceParams.mainNode && app.sourceParams.mainNode.length) {
      // Set iteration node from global source parameters
      source.params.mainNode = app.sourceParams.mainNode
      // Guess CSV structure with known delimiter
      structure = await getStreamStructure(
        source.stream,
        source.type,
        source.params.mainNode // Send predefined delimiter as an extra parameter
      )
    } else {
      // Guess CSV structure with known delimiter
      structure = await getStreamStructure(
        source.stream,
        source.type
      )
      // Set source delimiter from guessed structure object
      source.params.mainNode = structure.item
    }

    source.columns = structure.columns
  } else {
    // TODO: TEXT
  }

  */

  console.log('[Preprocess] Finished with structure')

  // By default, restructured collection has the same structure
  // source.pipeline.restructure.newColumns = source.columns.slice(0)
  // model.pipeline.source.newColumns = model.pipeline.source.columns.slice(0)

  // Check if we are in the RUN mode (loaded url)
  if (app.autorun) {
    // Deactivate RUN mode
    app.autorun = false
    // Load querified  pipeline
    // Object.assign(source.pipeline, app.runPipeline)
    // Process source
    console.log('[Preprocess] Start process()')
    app.process(modelId)
  } else {
    // By default open each source in the preview mode
    console.log('[Preprocess] Start preview()')
    app.previewDataframe(modelId)
  }
}
