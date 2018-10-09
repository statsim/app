// Convert RV distribution parameters object to string
function getParams (paramObj) {
  let paramStr = ''
  if (paramObj) {
    const paramKeys = Object.keys(paramObj).filter(k => (paramObj[k] !== ''))
    paramKeys.forEach((key, i) => {
      // Detect csv with commas and no brackets: add brackets
      const value = ((paramObj[key].indexOf(',') >= 0) && (paramObj[key].indexOf('(') < 0) && (paramObj[key].indexOf('[') < 0))
        ? `[${paramObj[key]}]`
        : paramObj[key]
      paramStr += `${key}: ${value}`
      paramStr += `${(i < paramKeys.length - 1) ? ', ' : ''}`
    })
  }
  return (paramStr.length) ? `{${paramStr}}` : ''
}

module.exports = function (models, activeModel) {
  let finalCode = ''
  let modelCodes = []

  console.log('Compiling models: ', models)

  /*
    ITERATING OVER ALL PROJECT MODELS
  */
  models.forEach((m, mi) => {
    let code = ''
    let indexFunctionDeclared = false // true if we already declared index function in the observer block

    // Check if the model is main or loaded as a function
    // Compile external models as functions
    // Use DATA blocks as input variables
    if (mi !== activeModel) {
      code += `var ${m.modelParams.name} = function (params) {\n`
      m.blocks
        .filter(b => ((b.typeCode === 2) && (b.useAsParameter)))
        .forEach((b, bi) => {
          // Make using model as a function easier parsing arguments as object and as usual coma-separated
          code += `var ${b.name} = ((typeof params !== 'undefined') && (typeof params.${b.name} !== 'undefined')) ? params.${b.name} : arguments[${bi}]\n`
        })
    }

    // Model generation
    let model = 'var model = function () {\n'

    // Step object needed when dealing with iterative models
    let step = {
      body: '',
      list: '_i',
      accum: '_i: _i + 1',
      initial: '_i: 1'
    }

    let modelOutput = ''
    let observers = ''

    /*
      ITERATING OVER ALL BLOCKS OF THE MODEL
    */
    m.blocks.forEach(b => {
      if (b.typeCode === 0) {
        // --> RANDOM VARIABLE

        let params = getParams(b.params)
        let varDeclaration = `var ${b.name} = sample(${b.distribution}(${params}))\n`
        // Check if we are inside the loop
        if ((m.modelParams.steps > 1.5) && (!b.once)) {
          step.body += varDeclaration
        } else {
          model += varDeclaration
        }
      } else if ((b.typeCode === 1) && b.value.length) {
        // --> EXPRESSION

        // Check if we are inside the loop
        if (m.modelParams.steps > 1.5) {
          // Generate a list of accumulators
          step.list += (step.list.length) ? ', ' : ''
          step.list += b.name + ((b.history) ? ', ' + b.name + '_hist' : '')
          // Caclulate expression in the body
          step.body += `var _${b.name} = ${b.value}\n`
          // Generate accumulator expressions
          step.accum += (step.accum.length ? ',\n' : '') + `${b.name}: _${b.name}`
          step.accum += (b.history) ? `,\n${b.name}_hist: ${b.name}_hist.concat(_${b.name})` : ''
          // Generate initial values
          step.initial += (step.initial.length ? ',\n' : '') + `${b.name}: 0`
          step.initial += (b.history) ? `,\n${b.name}_hist: [0]` : ''
        } else {
          model += `var ${b.name} = ${b.value}\n`
        }
      } else if ((b.typeCode === 2) && b.value.length) {
        // --> DATA

        // If value is comma-separated list, add array brackets
        // Upd: check if NaN add brackets
        // Upd: if empty string between ,, - undefined
        let valueStr = (b.value.indexOf(',') >= 0)
          ? `[${b.value.split(',').map(v => !isNaN(v) ? (v.length ? v : 'undefined') : `'${v}'`).join()}]`
          : !isNaN(b.value) ? b.value : `'${b.value}'`
        // Check if it's a Tensor
        if (b.dims && b.dims.length && !isNaN(parseInt(b.dims))) {
          valueStr = `Tensor([${b.dims}], ${valueStr})`
        }
        // Check if it's an external model
        if ((mi !== activeModel) && (b.useAsParameter)) {
          // In external model check if data value is already defined as a parameter
          // Use inner model value as default value in case parameter is missing
          model = `var ${b.name} = (typeof ${b.name} !== 'undefined') ? ${b.name} : ${valueStr}\n` + model
        } else {
          // Active model: place data on top of model
          model = `var ${b.name} = ${valueStr}\n` + model
        }
      } else if ((b.typeCode === 3) && b.value.length) {
        // --> ACCUMULATOR

        // Check if we are inside the loop
        if (m.modelParams.steps > 1.5) {
          // Generate a list of accumulators
          step.list += (step.list.length) ? ', ' : ''
          step.list += b.name + ((b.history) ? ', ' + b.name + '_hist' : '')
          // Accumulate value in the step body
          if ((b.max && b.max.length) || (b.min && b.min.length)) {
            step.body += `var __${b.name} = ${b.name} + ${b.value}\n`
            step.body += `var _${b.name} = `

            // Check max/min limits
            if (b.max && b.max.length) {
              step.body += `(__${b.name} > ${b.max}) ? ${b.max} : `
            }
            if (b.min && b.min.length) {
              step.body += `(__${b.name} < ${b.min}) ? ${b.min} : `
            }
            step.body += `__${b.name}\n`
          } else {
            step.body += `var _${b.name} = ${b.name} + ${b.value}\n`
          }
          // Generate accumulator expressions
          step.accum += (step.accum.length ? ',\n' : '') + `${b.name}: _${b.name}`
          step.accum += (b.history) ? `,\n${b.name}_hist: ${b.name}_hist.concat(_${b.name})` : ''
          // Generate initial values
          step.initial += (step.initial.length ? ',\n' : '') + `${b.name}: ${b.initialValue}`
          step.initial += (b.history) ? `,\n${b.name}_hist: [${b.initialValue}]` : ''
        } else {
          model += `var ${b.name} = ${b.initialValue} + ${b.value}\n`
        }
      } else if (b.typeCode === 4) {
        // --> OBSERVER BLOCK
        const isNumber = (str) => {
          if (typeof str !== 'string') {
            return false
          }
          return !isNaN(str) && !isNaN(parseFloat(str))
        }

        const isVector = (str) => {
          if (typeof str !== 'string') {
            return false
          }
          return ((str.indexOf(',') >= 0) && (str.indexOf('(') < 0))
        }

        const isScalarData = (str) => {
          let is = false
          m.blocks.forEach(b => {
            if ((b.typeCode === 2) && (b.name === str) && isNumber(b.value)) {
              is = true
            }
          })
          return is
        }

        const isVectorData = (str) => {
          let is = false
          m.blocks.forEach(b => {
            if ((b.typeCode === 2) && (b.name === str) && isVector(b.value) && (!b.hasOwnProperty('dims') || (b.dims.trim().length === 0))) {
              is = true
            }
          })
          return is
        }

        let observer = ''

        // Convert observer distribution params to string
        let params = getParams(b.params)

        // Remove white spaces
        let value = b.value.trim()

        // Check if the value is scalar or vector
        if (isNumber(value) || isScalarData(value)) {
          // Scalar
          observer += `observe(${b.distribution}(${params}), ${b.value})\n`
        } else if (isVector(value) || isVectorData(value)) {
          // Vector
          if (isVector(value) && (value.indexOf('[') < 0)) {
            // Inline vector without brackets:
            // Add brackets
            value = `[${value.trim()}]`
          }
          observer += `
mapIndexed(function (_j, _v) { 
  observe(${b.distribution}(${params}), _v)
}, ${value})\n`
        } else {
          // Here we actually not sure about what inside the Observer value
          // It could be inner expression or expression block or data-tensor
          // Make webppl check

          // Add function that generates multi-dimensional tensor indexes using the base index and tensor dimensions
          observer += (indexFunctionDeclared) ? '' : `
var _ind = function (i, d) {
  if (d.length > 1) {
    var nd = d.slice(1)
    var np = product(nd)
    var nrem = i % np
    var ni = (i - nrem) / np
    return [ni].concat(_ind(nrem, d.slice(1)))
  }
  return [i]
}\n`
          // Flag that we already declared the _ind function
          indexFunctionDeclared = true

          // Check the evaluated value in webppl
          observer += `
if (typeof (${value}) === 'number') {
  observe(${b.distribution}(${params}), ${b.value})
} else if (Array.isArray(${value})) {
  mapIndexed(function (_j, _v) {
    observe(${b.distribution}(${params}), _v)
  }, ${value})
} else if (typeof (${value}) === 'object') {
  var _dims = dims(${value})
  mapIndexed(function (_j, _v) {
    var __j = _ind(_j, _dims)
    var _j0 = (__j[0] !== undefined) ? __j[0] : undefined
    var _j1 = (__j[1] !== undefined) ? __j[1] : undefined
    var _j2 = (__j[2] !== undefined) ? __j[2] : undefined
    observe(${b.distribution}(${params}), _v)
  }, T.toScalars(${value}))
}\n`
        } // *else - tensor or else

        // Add observer code later, if in the loop
        if (m.modelParams.steps > 1.5) {
          observers += observer
        } else {
          model += observer
        }
      } else if ((b.typeCode === 5) && (b.value) && (b.value.length)) {
        // --> CONDITION BLOCK

        const cond = `condition(${b.value})\n`
        if (m.modelParams.steps > 1.5) {
          observers += cond
        } else {
          model += cond
        }
      }

      // End of blocks types. Finish compilation
      // Add needed block names to the model output

      if (
        b.name && b.show && (
          // Multi step simulation - output only what we can
          ((m.modelParams.steps > 1.5) && (((b.typeCode === 0) && b.once) || (b.typeCode === 1) || (b.typeCode === 2) || (b.typeCode === 3))) ||
          // One step - output all we want
          (m.modelParams.steps < 1.5)
        )
      ) { // Return variables
        modelOutput += b.name + ', ' + ((b.history && m.modelParams.steps > 1.5) ? b.name + '_hist, ' : '')
      }
    }) // End of block iterator

    // Generate steps
    if (m.modelParams.steps > 1.5) {
      model +=
`var step = function (n) {
if (n > 0) {
var {${step.list}} = step(n - 1)
${step.body}return {
${step.accum}
}
} else {
return {
${step.initial}
}
}
}
var {${step.list}} = step(${Math.round(m.modelParams.steps)})
`
      model += observers
    }

    // Generate output
    if (modelOutput.length > 0) {
      modelOutput = modelOutput.slice(0, -2) // Remove last comma from return object
      if ((modelOutput.indexOf(',') === -1) && (mi !== activeModel)) {
        model += `return ${modelOutput}\n` // no need in object output for external models
      } else {
        model += `return {${modelOutput}}\n`
      }
    }
    model += '}\n'
    code += model

    // Inference
    let inf = (mi === activeModel) ? '' : 'return '
    if (m.modelParams.method === 'deterministic') {
      inf += `model()\n`
    } else {
      let paramStr = ''
      let kernelStr = ''
      let kernelParamStr = ''
      let realMethod = m.modelParams.method
      Object.keys(m.methodParams).forEach(key => {
        if (key === 'steps' || key === 'stepSize') {
          kernelParamStr += (kernelParamStr.length) ? ', ' : ''
          kernelParamStr += `${key}: ${m.methodParams[key]}`
        } else {
          paramStr += `, ${key}: ${m.methodParams[key]}`
        }
      })
      if (m.modelParams.method === 'HMC') {
        realMethod = 'MCMC'
        kernelStr = (kernelParamStr.length) ? `, kernel: {HMC: {${kernelParamStr}}}` : `, kernel: 'HMC'`
      }
      inf += `Infer({model, method: '${realMethod}'${kernelStr + paramStr}})\n`
    }
    code += inf
    code += (mi === activeModel) ? `` : `}` // Finish the function if it's not a main model
    if (mi === activeModel) {
      modelCodes.push(code)
      finalCode += code + '\n'
    } else {
      modelCodes.push(code)
    }
  }) // *models.forEach

  console.log('Compiled models array: ', modelCodes)
  // Now we have an array of compiled models
  // Iteratively add only needed models to the code
  // We already have the main model added to the 'finalCode' text
  // We append only models used inside finalCode
  // Then check more to find 2nd, 3rd... level models
  let iter = (modelCodes.length > 1)
  // Models already added to the final code
  let added = [activeModel]
  while (iter) {
    iter = false
    modelCodes.forEach((mc, mci) => {
      if ((added.indexOf(mci) === -1) && (finalCode.indexOf(models[mci].modelParams.name) >= 0)) {
        finalCode = mc + '\n' + finalCode
        added.push(mci)
        iter = true
      }
    })
  }

  return finalCode
}