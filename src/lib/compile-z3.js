const esprima = require('esprima')
const { data } = require('vis-network')
const log = (...args) => console.log('[Z3 compiler]', ...args)

function operatorToSMT (op) {
  const map = {
    '&&': 'and',
    '||': 'or',
    '==': '=',
    '===': '=',
    '!': 'not',
    '%': 'rem' // reminder
  }
  return Object.keys(map).includes(op) ? map[op] : op
}

function generateExpression(expressionType, params, dataType) {
  switch (expressionType) {
    case 'If..Else':
      return `${dataType} (ite ${params.condition} ${params.true} ${params.false})`;
    case 'Length':
      return `(str.len ${params.input})`;
    case 'Sum':
    case 'Reduce sum':
      return `(sum ${params.input})`;
    case 'Product':
    case 'Reduce product':
      return `(product ${params.input})`;
    case 'Mean':
    case 'Reduce mean':
      return `Real (/ (sum ${params.input}) (str.len ${params.input}))`;
    case 'Slice':
      if (params.end && params.end.trim() !== '') {
        return `(str.substr ${params.input} ${params.start} ${params.end})`;
      } else {
        return `(str.substr ${params.input} ${params.start})`;
      }
    case 'Add':
      return `${dataType} (+ ${params.a} ${params.b})`;
    case 'Subtract':
      return `${dataType} (- ${params.a} ${params.b})`;
    case 'Multiply':
      return `${dataType} (* ${params.a} ${params.b})`;
    case 'Divide':
      return `${dataType} (/ ${params.a} ${params.b})`;
    case 'Power':
      return `${dataType} (math.pow ${params.a} ${params.b})`;
    case 'Log':
      return `Real (math.log ${params.a})`;
    case 'Exp':
      return `Real (math.exp ${params.a})`;
    case 'Sqrt':
      return `${dataType} (math.sqrt ${params.a})`;
    case 'Abs':
      return `${dataType} (math.abs ${params.a})`;
    case 'Sin':
      return `Real (math.sin ${params.a})`;
    case 'Cos':
      return `Real (math.cos ${params.a})`;
    case 'Tan':
      return `Real (math.tan ${params.a})`;
    case 'Ceil':
      return `Int (math.ceil ${params.a})`;
    case 'Floor':
      return `Int (math.floor ${params.a})`;
    case 'Round':
      return `Int (math.round ${params.a})`;
    case 'Min':
      return `${dataType} (math.min ${params.a} ${params.b})`;
    case 'Max':
      return `${dataType} (math.max ${params.a} ${params.b})`;
    case 'And':
      return `Bool (and ${params.a} ${params.b})`;
    case 'Or':
      return `Bool (or ${params.a} ${params.b})`;
    case 'Not':
      return `Bool (not ${params.a})`;
    case 'Equal':
      return `Bool (= ${params.a} ${params.b})`;
    case 'Not equal':
      return `Bool (not (= ${params.a} ${params.b}))`;
    case 'Greater than':
      return `Bool (> ${params.a} ${params.b})`;
    case 'Greater than or equal':
      return `Bool (>= ${params.a} ${params.b})`;
    case 'Less than':
      return `Bool (< ${params.a} ${params.b})`;
    case 'Less than or equal':
      return `Bool (<= ${params.a} ${params.b})`;
  }
  throw new Error(`Z3 compiler: Expression type ${expressionType} is not supported`)
}

function toSMT (js) {
  const p = esprima.parseScript(js).body[0]
  function proc (exp) {
    log('Converting to SMT:', exp)
    // Convert a != b to !(a == b)
    switch (exp.type) {
      case 'CallExpression':
        let res = ''
        exp.arguments.forEach(e => { res += proc(e) + ' ' })
        return '(' + exp.callee.name + ' ' + res + ')'
      case 'UnaryExpression':
        return '(' + operatorToSMT(exp.operator) + ' ' + proc(exp.argument) + ')'
      case 'BinaryExpression':
        if ((exp.operator === '!=') || (exp.operator === '!==')) {
          exp.operator = '=='
          exp = {
            'type': 'UnaryExpression',
            'operator': '!',
            'argument': exp
          }
          return proc(exp)
        } else {
          return '(' + operatorToSMT(exp.operator) + ' ' + proc(exp.left) + ' ' + proc(exp.right) + ')'
        }
      case 'MemberExpression':
        return proc(exp.object) + '_' + proc(exp.property)
        // return '(select ' + proc(exp.object) + ' ' + proc(exp.property) + ')'
      case 'ConditionalExpression':
        return '(ite ' + proc(exp.test) + ' ' + proc(exp.consequent) + ' ' + proc(exp.alternate) + ')'
      case 'Identifier':
        return exp.name
      case 'Literal':
        return exp.value
    }
  }

  return proc(p.expression)
}

// Generate SMT code for the data block
function dataCode (name, value, type, min, max) {
  let c = ''
  if (value.length) {
    const val = (type === 'Real') && !value.includes('.') ? value + '.0' : value
    c += `(define-fun ${name} () ${type} ${val})\n`
  } else {
    c += `(declare-const ${name} ${type})\n`
    if ((typeof min !== 'undefined') && ((min + '').trim() !== '')) {
      c += `(assert ${toSMT(name + ' >= ' + min)})\n`
    }
    if ((typeof max !== 'undefined') && ((max + '').trim() !== '')) {
      c += `(assert ${toSMT(name + ' <= ' + max)})\n`
    }
  }
  return c
}

// Generate flat naming for high-dimensional arrays
function genArrayNames (name, dims) {
  const shape = dims.split(',').map(v => parseInt(v))
  let res = [name]
  shape.forEach(dim => {
    res = res.map(v => Array(dim).fill(0).map((_, i) => v + '_' + i)).flat()
  })
  return res
}

module.exports = function (models, activeModel) {
  const model = models[activeModel]
  log(`Processing model: ${activeModel} of ${models.length} (${model.modelParams.name})`)

  let code = ''

  const dataTypes = {
    'float': 'Real',
    'integer': 'Int',
    'boolean': 'Bool'
  }

  // Iterate over all blocks of the model
  model.blocks.forEach(block => {
    let dataType = Object.keys(dataTypes).includes(block.dataType) ? dataTypes[block.dataType] : 'Int'
    if ((block.typeCode === 0) && block.name.length) {
      // Variable
      let min
      let max
      // Use provided distributions to infer min/max/dataType
      if (block.distribution && block.distribution.toLowerCase() === 'uniform') {
        min = block.params.a
        max = block.params.b
        dataType = 'Real'
      } else if (block.distribution && block.distribution.toLowerCase() === 'randominterger') {
        min = 0
        max = block.params.n
        dataType = 'Int'
      }
      if (block.dims && block.dims.length && block.dims !== '1') {
        // Create array of unknown variables (pass '' as the value)
        genArrayNames(block.name, block.dims).forEach((name, ni) => {
          code += dataCode(name, '', dataType, min, max)
        })
      } else {
        // Create scalar unknown variable (pass '' as the value)
        code += dataCode(block.name, '', dataType, min, max)
      }
    } else if ((block.typeCode === 1) && block.name.length) {
      // Expression
      // Skip the block if no expressionType is provided
      if (!block.expressionType) {
        return
      }
      if (block.expressionType.toLowerCase() === 'custom') {
        // Expression: Custom
        if (typeof block.params.expression !== 'undefined') {
          code += `(define-fun ${block.name} () ${dataType} ${toSMT(block.params.expression)})\n`
        } else {
          throw new Error(`Expression ${block.name} is not defined in params.expression`)
        }
      } else {
        // Expression: Other
        // ${dataType} is returned as a string by generateExpression (e.g. `Bool (< x y)`)
        code += `(define-fun ${block.name} () ${generateExpression(block.expressionType, block.params, dataType)})\n`
      }
    } else if ((block.typeCode === 2) && block.name.length) {
      // Data block
      if (['array', 'vector', 'tensor'].includes(block.dataType) && block.dims) {
        // Array or vector
        const cellType = Object.keys(dataTypes).includes(block.cellType) ? dataTypes[block.cellType] : 'Int'
        const names = genArrayNames(block.name, block.dims)
        const values = block.value.includes(',')
          ? block.value.replace(/\[|\]|\s/g, '').split(',')
          : names.map(_ => block.value) // Repeat block value
        names.forEach((name, ni) => {
          code += dataCode(name, values[ni], cellType, block.min, block.max)
        })
      } else {
        // Scalar
        code += dataCode(block.name, block.value, dataType, block.min, block.max)
      }
    } else if ((block.typeCode === 3) && (block.value) && (block.value.length)) {
      // Accumulator
      code += `(define-fun ${block.name}__0 () ${dataType} ${toSMT(block.initialValue + '')})\n`
      const s = model.modelParams.steps
      // Add loop
      for (let i = 0; i < s; i++) {
        const value = block.name + '__' + i + ' + ' + block.value
        // code += `(define-fun ${block.name + ((i < (s - 1)) ? '__' + (i + 1) + '' : '')} () ${dataType} ${toSMT(value)})\n`
        code += `(define-fun ${block.name}__${i + 1} () ${dataType} ${toSMT(value)})\n`
      }
      code += `(declare-const ${block.name} ${dataType})\n`
      code += `(assert ${toSMT(block.name + ' == ' + block.name + '__' + s)})\n`
      // Add min/max conditions
      if (block.min && block.min.length) {
        code += `(assert ${toSMT(block.name + ' >= ' + block.min)})\n`
      }
      if (block.max && block.max.length) {
        code += `(assert ${toSMT(block.name + ' <= ' + block.max)})\n`
      }
    } else if ((block.typeCode === 5) && (block.value) && (block.value.length)) {
      // Condition block
      code += `(assert ${toSMT(block.value)})\n`
    } else if ((block.typeCode === 7) && block.name.length) {
      // Function block
      const fargs = block.x.split(',').map(a => a.trim()).filter(a => a.length).map(a => '(' + a + ')').join(' ')
      if (block.y.length) {
        code += `(define-fun ${block.name} (${fargs}) ${dataType} ${toSMT(block.y)})\n`
      } else {
        code += `(declare-fun ${block.name} (${fargs}) ${dataType})\n`
      }
    } else if ((block.typeCode === 8) && (block.value) && (block.value.length)) {
      // Optimization block
      code += `(${block.optimizationType} ${toSMT(block.value)})\n`
    }
  })

  code += '(check-sat)\n(get-model)\n(get-objectives)\n(echo "---")\n(exit)'

  return code
}
