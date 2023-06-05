import { 
  defineNode, 
  defineDynamicNode,
  CheckboxInterface,
  IntegerInterface,
  NodeInterface, 
  TextInterface,
  TextInputInterface,
  NumberInterface, 
  SelectInterface 
} from 'baklavajs';

const esprima = require('esprima')

const distributions = require('./distributions')
const expressions = require('./expressions')
const expressionsMath = require('./expressionsMath')
const expressionsLogic = require('./expressionsLogic')
const expressionsList = require('./expressionsList')

// Define a custom node
const DataNode = defineDynamicNode({
  type: 'Data',
  inputs: {
    name: () => new TextInputInterface('Name', 'X').setPort(false),
    dataType: () => new SelectInterface(
      'Data type', 
      'integer', 
      ['auto', 'proxy', 'boolean', 'integer', 'float', 'string', 'category', 'array', 'vector', 'tensor']
    ).setPort(false),
  },
  onUpdate({ dataType }) {
    console.log(dataType)
    const inputs = {}
    if (dataType === 'integer') {
      inputs['value'] = () => new IntegerInterface('Value', 0).setPort(false)
    } else if (dataType === 'float') {
      inputs['value'] = () => new NumberInterface('Value', 0).setPort(false)
    } else if (dataType === 'boolean') {
      inputs['value'] = () => new CheckboxInterface('Value', false).setPort(false)
    } else {
      inputs['value'] = () => new TextInputInterface('Value', '').setPort(false)
    }
    return {
      inputs,
      forceUpdateInputs: ['value']
    }
  },
  outputs: {
    output: () => new NodeInterface('Output', 0),
  },
})

// Define a custom node
// https://v2.baklava.tech/nodes/dynamic-nodes.html
const VariableNode = defineDynamicNode({
  type: 'Variable',
  inputs: {
    show: () => new CheckboxInterface('Show in results', true).setPort(false),
    name: () => new TextInputInterface('Name', '').setPort(false),
    operation: () => new SelectInterface(
      'Distribution', 
      'None', 
      ['None'].concat(Object.keys(distributions))
    ).setPort(false),
    dims: () => new IntegerInterface('Shape', 1),
  },
  onUpdate({ operation }) {
    if (operation === 'None') {
      return {
        inputs: {}
      }
    } else {
      const inputs = {}
      const params = distributions[operation]
      Object.keys(params).forEach(paramName => {
        const param = params[paramName]
        if (param.type === 'int')
          inputs[paramName] = () => new IntegerInterface(paramName, 0, param.min, param.max)
        else if (param.type === 'vector')
          inputs[paramName] = () => new TextInputInterface(paramName, '')
        else
          inputs[paramName] = () => new NumberInterface(paramName, 0, param.min, param.max)
      })
      return {
        inputs
      }
    }
  },
  outputs: {
      output: () => new NodeInterface('Output', 0),
  },
})

/*
const ExpressionNode = defineDynamicNode({
    type: 'Expression',
    inputs: {
        name: () => new TextInputInterface('Name', '').setPort(false),
        operation: () => new SelectInterface(
          'Expression type', 
          Object.keys(expressions)[0], 
          Object.keys(expressions)
        ).setPort(false),
    },
    onUpdate({ operation }) {
      const inputs = {}
      const params = expressions[operation]
      Object.keys(params).forEach(paramName => {
        const param = params[paramName]
        if (param.type === 'int')
          inputs[paramName] = () => new IntegerInterface(paramName, 0)
        else if (param.type === 'float')
          inputs[paramName] = () => new NumberInterface(paramName, 0)
        else
          inputs[paramName] = () => new TextInputInterface(paramName, '')
          inputs[paramName + '_nodes'] = () => new TextInputInterface(paramName + '_nodes', '')
      })
      return {
          inputs
      }
    },
    outputs: {
        output: () => new NodeInterface('Output', 0),
    }
})
*/

function getInputsFromExpression(expression) {
  const inputs = {}
  try {
    const tokens = esprima.tokenize(expression)
    tokens.forEach(token => {
      if (token.type === 'Identifier') {
        inputs[token.value] = () => new TextInputInterface(token.value, '')
      }
    })
  } catch (e) {
    // Do nothing
  }
  return inputs
}

// Define a custom node
const ExpressionCustomNode = defineDynamicNode({
  type: 'Expression (Custom)',
  inputs: {
    show: () => new CheckboxInterface('Show in results', true).setPort(false),
    name: () => new TextInputInterface('Name...', '').setPort(false),
    expression: () => new TextInputInterface('Expression string...', 'Input').setPort(false),
  },
  onUpdate({ expression }) {
    return {
      inputs: getInputsFromExpression(expression)
    }
  },
  outputs: {
      output: () => new NodeInterface('Output', 0),
  }
})


function defineExpressionNode(expressionType, expressions) {
  return defineDynamicNode({
    type: `Expression (${expressionType})`,
    inputs: {
      show: () => new CheckboxInterface('Show in results', true).setPort(false),
      name: () => new TextInputInterface('Name', '').setPort(false),
      operation: () => new SelectInterface(
        'Expression type', 
        Object.keys(expressions)[0], 
        Object.keys(expressions)
      ).setPort(false),
    },
    onUpdate({ operation }) {
      const inputs = {}
      const params = expressions[operation]
      Object.keys(params).forEach(paramName => {
        const param = params[paramName]
        if (param.type === 'int') {
          inputs[paramName] = () => new IntegerInterface(paramName, 0)
        } else if (param.type === 'float') {
          inputs[paramName] = () => new NumberInterface(paramName, 0)
        } else {
          inputs[paramName] = () => new TextInputInterface(paramName, '')
        }
      })
      return {
          inputs
      }
    },
    outputs: {
        output: () => new NodeInterface('Output', 0),
    }
  })
}

const ExpressionMathNode = defineExpressionNode('Math', expressionsMath)
const ExpressionLogicNode = defineExpressionNode('Logic', expressionsLogic)
const ExpressionListNode = defineExpressionNode('List', expressionsList)

// Define a custom node
/*
const ConditionNode = defineNode({
    type: 'Condition',
    inputs: {
      value: () => new TextInputInterface('Value', ''),
    },
    outputs: {}
})
*/


// Accumulator
const AccumulatorNode = defineDynamicNode({
  type: 'Accumulator',
  inputs: {
    show: () => new CheckboxInterface('Show in results', true).setPort(false),
    name: () => new TextInputInterface('Name...', '').setPort(false),
    value: () => new TextInputInterface('Value', 'Increment').setPort(false),
    initialValue: () => new NumberInterface('Initial', 0),
    min: () => new TextInputInterface('Min', ''),
    max: () => new TextInputInterface('Max', ''),
  },
  onUpdate({ value }) {
    return { 
      inputs: getInputsFromExpression(value) 
    }
  },
  outputs: {
    output: () => new NodeInterface('Output', 0),
  }
})

// Condition
const ConditionNode = defineDynamicNode({
  type: 'Condition',
  inputs: {
    value: () => new TextInputInterface('Value', 'Input').setPort(false),
  },
  onUpdate({ value }) {
    return {
      inputs: getInputsFromExpression(value)
    }
  },
  outputs: {}
})

// Optimize
const OptimizeNode = defineDynamicNode({
  type: 'Optimize',
  inputs: {
    operation: () => new SelectInterface(
      'Optimization type', 
      'Minimize', 
      ['Maximize', 'Minimize']
    ).setPort(false),
    value: () => new TextInputInterface('Value', 'Input').setPort(false),
  },
  onUpdate({ value }) {
    return {
      inputs: getInputsFromExpression(value)
    }
  },
  outputs: {}
})

export default [
  VariableNode,
  ExpressionCustomNode,
  ExpressionMathNode,
  ExpressionLogicNode,
  ExpressionListNode,
  DataNode, 
  AccumulatorNode,
  ConditionNode,
  OptimizeNode
]