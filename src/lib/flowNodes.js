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
    name: () => new TextInputInterface('Name', '').setPort(false),
    dataType: () => new SelectInterface(
      'Data type', 
      'integer', 
      ['auto', 'proxy', 'boolean', 'integer', 'float', 'string', 'category', 'array', 'vector', 'tensor']
    ).setPort(false),
  },
  onUpdate({ dataType }) {
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

    // When using `forceUpdateInputs`, dynamic inputs will be updated even if only `name` changes
    // That mean loosing the value of the input. To avoid that, we store the previous trigger value
    // and only update the inputs if the value changes.
    const update = this.previousValue !== dataType
    this.previousValue = dataType

    return {
      inputs,
      forceUpdateInputs: update ? ['value'] : []
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
      const update = this.previousValue !== operation
      this.previousValue = operation
      return {
        inputs,
        forceUpdateInputs: update ? ['value'] : []
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

const mathMethods = Object.getOwnPropertyNames(Math).filter(prop => {
  return typeof Math[prop] === 'function';
})

function getInputsFromExpression(expression) {
  const inputs = {}
  try {
    const tokens = esprima.tokenize(expression)
    tokens.forEach((token, ti) => {
      if (token.type === 'Identifier') {
        if (token.value === 'Math') return
        if (ti > 0 && tokens[ti - 1].type === 'Punctuator' && tokens[ti - 1].value === '.') return
        inputs[token.value] = () => new TextInputInterface(token.value, '')
      }
    })
  } catch (e) {
    console.error(e)
  }
  return inputs
}

// Define a custom node
const ExpressionCustomNode = defineDynamicNode({
  type: 'Expression (Custom)',
  inputs: {
    show: () => new CheckboxInterface('Show in results', true).setPort(false),
    name: () => new TextInputInterface('Name', '').setPort(false),
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
    name: () => new TextInputInterface('Name', '').setPort(false),
    increment: () => new TextInputInterface('Increment', 'Increment').setPort(false),
    initialValue: () => new NumberInterface('Initial', 0),
    min: () => new TextInputInterface('Min', ''),
    max: () => new TextInputInterface('Max', ''),
  },
  onUpdate({ increment }) {
    return { 
      inputs: getInputsFromExpression(increment) 
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
  DataNode, 
  VariableNode,
  ExpressionCustomNode,
  ExpressionMathNode,
  ExpressionLogicNode,
  ExpressionListNode,
  AccumulatorNode,
  ConditionNode,
  OptimizeNode
]