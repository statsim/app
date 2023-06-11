
const esprima = require('esprima')

const blockClasses = require('./blockClasses')
const distributions = require('./distributions')
const expressionsAll = require('./expressions')
const expressions = {
  'Custom': require('./expressionsCustom'),
  'Math': require('./expressionsMath'),
  'Logic': require('./expressionsLogic'),
  'List': require('./expressionsList'),
}

function genId (suffix) {
  return suffix + '_' + Math.random().toString(16).slice(2, 9)
}

const blockClassMap = {}
blockClasses.forEach(blockClass => {
  blockClassMap[blockClass.name] = blockClass
})



function flowToBlocks (flowInput, log) {
  const flow = JSON.parse(JSON.stringify(flowInput)) // Clone
  const connectionMap = {} // Map from outputId to name
  flow.graph.connections.forEach(connection => {
    const nodeName = flow.graph.nodes
      .find(node => node.outputs.output && node.outputs.output.id === connection.from)
      .inputs.name.value
    connectionMap[connection.from] = nodeName
  })
  log('[flowToBlocks] Connection map:', connectionMap)

  function getConnectionName (id) {
    const connection = flow.graph.connections.find(c => c.to === id)
    if (connection) {
      return connectionMap[connection.from]
    }
    return null
  }

  log('[flowToBlocks]', flow)
  const blocks = []
  flow.graph.nodes.forEach((node, ni) => {
    const blockClass = node.type.includes('Expression')
      ? blockClassMap['Expression']
      : blockClassMap[node.type]
    const block = new blockClass(ni)
    block.id = node.id

    // First deal with edge cases (Expressions, Variables, etc.)
    // For each input, remove it from the node and add it to the block

    // Case: Expression
    if (node.type.includes('Expression')) {
      if (node.type.includes('Custom')) {
        // Subcase: Custom expression
        block.expressionType = 'Custom'
        block.params.expression = node.inputs.expression.value
        delete node.inputs.expression
        // Here expression can have dynamic inputs 
        // For example, expression: "x + y" has x and y as dynamic inputs with possibleconnections)
        // Those inputs can have values or connections
        Object.keys(node.inputs).forEach(inputName => {
          const input = node.inputs[inputName]
          // Check if input is present in the expression
          if (block.params.expression.includes(inputName)) {
            // 1. Input has incoming connections
            const connectionName = getConnectionName(input.id)
            if (connectionName) {
              block.params.expression = block.params.expression.replace(inputName, connectionName)
            }
            // 2. Input has a value and no incoming connections
            else if (input.value !== undefined) {
              block.params.expression = block.params.expression.replace(inputName, input.value)
            }
            // Remove input from the node
            delete node.inputs[inputName]
          }
        })
      } else {
        // Subcase: Template expression (e.g. Math, Logic, List)
        block.expressionType = node.inputs.operation.value
        block.params = {}
        Object.keys(expressionsAll[node.inputs.operation.value]).forEach(inputName => {
          const input = node.inputs[inputName]
          const connectionName = getConnectionName(input.id)
          // 1. Input has incoming connections
          if (connectionName) {
            block.params[inputName] = connectionName
          }
          // 2. Input has a value and no incoming connections
          else if (input.value !== undefined) {  
            block.params[inputName] = input.value
          }
          delete node.inputs[inputName]
        })
        delete node.inputs.operation
      }
    }

    // Case: Variable
    if (node.type === 'Variable' && node.inputs.operation && node.inputs.operation.value !== 'None') {
      block.distribution = node.inputs.operation.value
      block.params = {}
      Object.keys(distributions[node.inputs.operation.value]).forEach(inputName => {
        const input = node.inputs[inputName]
        const connectionName = getConnectionName(input.id)
        // 1. Input has incoming connections
        if (connectionName) {
          block.params[inputName] = connectionName
        }
        // 2. Input has a value and no incoming connections
        else if (input.value !== undefined) {  
          block.params[inputName] = input.value
        }
      })
      delete node.inputs.operation
    }

    // Case: Condition, Optimize
    if (node.type === 'Condition' || node.type === 'Optimize') {
        block.value = node.inputs.value.value
        delete node.inputs.value
        // Similarly to custom expression, value can have dynamic inputs
        Object.keys(node.inputs).forEach(inputName => {
          const input = node.inputs[inputName]
          // Check if input is present in the expression
          if (block.value.includes(inputName)) {
            // 1. Input has incoming connections
            const connectionName = getConnectionName(input.id)
            if (connectionName) {
              block.value = block.value.replace(inputName, connectionName)
            }
            // 2. Input has a value and no incoming connections
            else if (input.value !== undefined) {
              block.value = block.value.replace(inputName, input.value)
            }
            // Remove input from the node
            delete node.inputs[inputName]
          }
        })
    }

    // If some inputs are left, add them to the block
    // E.g. `name` or `show`
    Object.keys(node.inputs).forEach(inputName => {
      const input = node.inputs[inputName]
      block[inputName] = input.value
    })

    blocks.push(block)
  })
  return blocks
}

function addDynamicExpressionInputs(node, expression) {
  try {
    esprima.tokenize(expression).forEach(token => {
      if (token.type === 'Identifier') {
        node.inputs[token.value] = {
          id: genId('i'),
          value: token.value,
          type: 'string'
        }
      }
    })
  } catch (e) {
    console.error(e)
  }
}

function blockToNode(block, position) {
  const blockClassName = blockClasses[block.typeCode].name
  let nodeType = blockClassName
  
  // With expressions there's no 1-to-1 mapping between block type and node type
  // There's only one block class for expressions, but there are many expression node types
  let expressionGroup = null
  if (blockClassName === 'Expression' && typeof block.expressionType !== 'undefined') {
    Object.keys(expressions).forEach(expressionGroupCurrent => {
      if (Object.keys(expressions[expressionGroupCurrent]).includes(block.expressionType)) {
        expressionGroup = expressionGroupCurrent
        nodeType = `Expression (${expressionGroupCurrent})`
        return
      }
    })
  } 

  const node = {
    id: genId('n'),
    type: nodeType,
    title: nodeType,
    inputs: {},
    outputs: {},
    position: position,
    width: 200,
    twoColumn: false
  }

  // Name
  if (typeof block.name !== 'undefined') {
    node.inputs.name = {
      id: genId('i'),
      value: block.name
    }
  }

  // In blocks models strict integer/float inputs can contain string names of other blocks
  // Baklava throws TypeError: intf.value.value.toFixed is not a function

  // [Variable]
  if (block.typeCode === 0) {
    // Variable -> Distribution, Params
    if (typeof block.distribution !== 'undefined') {
      node.inputs.operation = {
        id: genId('i'),
        value: block.distribution
      }
      const params = distributions[block.distribution]
      Object.keys(params).forEach(paramName => {
        const param = params[paramName]
        node.inputs[paramName] = {
          id: genId('i'),
          value: block.params[paramName] || param.default || 0,
          type: param.type
        }
      })
    }
    // Variable -> Shape
    if (typeof block.dims !== 'undefined') {
      node.inputs.dims = {
        id: genId('i'),
        value: parseInt(block.dims)
      }
    }
  }

  // [Expression]
  if (block.typeCode === 1 && expressionGroup !== null) {
    if (expressionGroup === 'Custom') {
      const expression = block.params.expression || block.value || ''
      node.inputs.expression = {
        id: genId('i'),
        value: expression,
        type: 'expression'
      }
      addDynamicExpressionInputs(node, expression)
    } else {
      node.inputs.operation = {
        id: genId('i'),
        value: block.expressionType
      }
      const params = expressions[expressionGroup][block.expressionType]
      Object.keys(params).forEach(paramName => {
        const param = params[paramName]
        node.inputs[paramName] = {
          id: genId('i'),
          value: typeof block.params[paramName] === 'undefined' ? '' : block.params[paramName],
          type: param.type
        }
      })
    }
  }

  // [Data]
  if (block.typeCode === 2) {
    // Get data type and prepare value
    const dataType = typeof block.dataType === 'string' && block.dataType.trim() !== '' 
      ? block.dataType.trim() 
      : 'integer'
    let value
    if (dataType === 'integer') {
      value = parseInt(block.value) || 0 // 0 if NaN or null
    } else if (dataType === 'float') {
      value = parseFloat(block.value) || 0
    } else if (dataType === 'boolean') {
      value = block.value === 'true' || block.value === true
    } else {
      value = block.value + ''
    } 
    // Add inputs
    node.inputs.dataType = {
      id: genId('i'),
      value: dataType
    }
    node.inputs.value = {
      id: genId('i'),
      value: value
    }
  } 

  // [Accumulator]
  if (block.typeCode === 3) {
    node.inputs['initialValue'] = {
      id: genId('i'),
      value: block['initialValue'] || 0,
      type: 'float'
    }
    node.inputs['increment'] = {
      id: genId('i'),
      value: block['increment'] || 1,
      type: 'float'
    }
    ;['min', 'max'].forEach(paramName => {
      node.inputs[paramName] = {
        id: genId('i'),
        value: block[paramName] || '',
        type: 'string'
      }
    })
  }
    
  // `show` (for Variable, Expression, Accumulator)
  if (typeof block.show !== 'undefined' && [0, 1, 3].includes(block.typeCode)) {
    node.inputs.show = {
      id: genId('i'),
      value: block.show
    }
  }
  
  // `value` (for Accumulator, Condition and Optimize)
  if (typeof block.value !== 'undefined' && [3, 5, 8].includes(block.typeCode)) {
    node.inputs.value = {
      id: genId('i'),
      value: block.value || '',
    }
    addDynamicExpressionInputs(node, block.value)
    node.inputs.value.type = 'expression'
  }

  // Add outputs
  if (block.typeCode < 4) {
    node.outputs.output = {
      id: genId('o'),
      value: undefined
    }
  }
  return node
}

function blocksToFlow (blocks, positions, log) {
    log('[blocksToFlow] Positions before:', positions)
    // Create sorted list of unique x and y positions
    const xSet = Array.from(new Set(positions.map(p => p.x)))

    const ySet = Array.from(new Set(positions.map(p => p.y)))
    console.log(xSet, ySet)
    positions.forEach(p => {
      p.x = 300 + xSet.indexOf(p.x) * 350
      p.y = ySet.indexOf(p.y) * 430
    })
    log('[blocksToFlow] Positions after:', positions)

    // ...
    log('[blocksToFlow]', blocks)
    const graph = {
      id: 'g_' + Math.random().toString(16).substr(2, 9),
      inputs: [],
      outputs: [],
    }

    // First pass: 
    // - create nodes from blocks (with possible string inputs)
    // - create map of block name -> output id
    const nodes = []
    const nameToOutputIdMap = {}
    blocks.forEach((block, bi) => {
      const node = blockToNode(block, positions[bi])
      nodes.push(node)
      if (typeof node.inputs.name === 'undefined') return
      if (typeof node.outputs.output === 'undefined') return
      nameToOutputIdMap[node.inputs.name.value] = node.outputs.output.id
    })
    log('nameToOutputIdMap', nameToOutputIdMap)

    // Second pass: create connections, removing string inputs
    const connections = []
    nodes.forEach((node, ni) => {
      // Data has no inputs
      if (node.type === 'Data') return

      // Get list of all node names that can be mentioned in the current node inputs
      const allOtherNodeNames = Object.keys(nameToOutputIdMap)
        .filter(name => typeof node.inputs.name === 'undefined' || name !== node.inputs.name.value)

      Object.keys(node.inputs).forEach(inputName => {
        const input = node.inputs[inputName]
        // Skip name input
        if (inputName === 'name') return 
        // Skip if input is not a string (here's it's not node type, but input value type)
        if (typeof input.value !== 'string') return
        if (input.value === '') return
        if (input.type === 'expression') return
        const allConnectedNodeNames = allOtherNodeNames.filter(name => {
          const re = new RegExp(`\\b${name}\\b`)
          return re.test(input.value)
        })
        allConnectedNodeNames.forEach(nodeName => {
          log(`Adding connection: ${nodeName} -> ${node.id}.${inputName}`)
          connections.push({
            id: genId('c'),
            from: nameToOutputIdMap[nodeName],
            to: input.id
          })
        })
        // Clean up
        if (typeof input.type === 'undefined') return
        if (input.type === 'int') {
          input.value = parseInt(input.value) || 0
        } else if (input.type === 'float') {
          input.value = parseFloat(input.value) || 0
        }
        delete node.inputs[inputName].type
      })
    })
          
    graph.nodes = nodes
    graph.connections = connections

    log('[blocksToFlow]', JSON.stringify(graph, null, 2))

    return {
      graph,
      graphTemplates: []
    }
}

export {
    flowToBlocks,
    blocksToFlow
}