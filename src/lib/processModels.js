const blockClasses = require('./blockClasses')
const expressions = require('./expressions')

function processModels (models) {
  models.forEach(model => {
    if (typeof model.modelParams.include === 'undefined') {
      model.modelParams.include = []
    }

    if (model.blocks) {
      model.blocks.forEach(block => {
        // Set right block classes
        block.type = blockClasses[block.typeCode].name
            
        // Add ID to each block for better list rendering
        // Keep it here because parseLink generates a model in multiple places
        if (typeof block.id === 'undefined') {
          block.id = 'b_' + Math.random().toString(16).slice(2, 9)
        }

        // Apply expression correction
        if (block.typeCode === 1) {
          if (typeof block.expressionType === 'undefined') {
            block.expressionType = Object.keys(expressions)[0] // First - default
          }
          if (typeof block.params  === 'undefined' || Object.keys(block.params).length === 0) {
            block.params = {}
            Object.keys(expressions[block.expressionType]).forEach((paramName, pi) => {
              if (pi === 0 && typeof(block.value) !== 'undefined') {
                block.params[paramName] = block.value
                delete block.value
              } else {
                block.params[paramName] = ''
              }
            })
          }
        }

        // Apply accumulator correction
        if (block.typeCode === 3) {
          if (typeof block.increment === 'undefined' && typeof block.value !== 'undefined') {
            block.increment = block.value
            delete block.value
          }
        }
      })
    }
  })
}

module.exports = processModels

