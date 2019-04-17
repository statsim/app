const methods = require('./methods')
const spacesToUnderscores = require('./spacesToUnderscores')
const addIterationChecks = require('./addIterationChecks')

const dict = {
  // Distributions
  'Beta_a': 'alpha',
  'Beta_b': 'beta',
  'Cauchy_location': 'alpha',
  'Cauchy_scale': 'beta',
  'Categorical_ps': 'p',
  'Delta': 'Constant',
  'Delta_v': 'c',
  'Dirichlet_alpha': 'a',
  'Discrete': 'Categorical',
  'Discrete_ps': 'p',
  'Exponential_a': 'lam',
  'Gamma_shape': 'mu',
  'Gamma_scale': 'sd',
  'Gaussian': 'Normal',
  'Gaussian_sigma': 'sd',
  'Laplace_location': 'mu',
  'Laplace_scale': 'b',
  'LogitNormal_sigma': 'sd',
  'Multinomial_ps': 'p',
  'MultivariateGaussian': 'MvNormal',
  'StudentT_sigma': 'sd',
  'Uniform_a': 'lower',
  'Uniform_b': 'upper',
  // Inference
  'samples': 'draws',
  'burn': 'tune',
  'MCMC': 'Metropolis',
  'HMC': 'HamiltonianMC'
}

function translate (s, dist) {
  let res = dist ? dict[dist + '_' + s] : dict[s]
  return res || s
}

function generateExpression (expressionType, params) {
  switch (expressionType) {
    case 'If..Else':
      return `pm.math.switch(${params.condition}, ${params.true}, ${params.false})`
    case 'Sum':
      return `pm.math.sum(${params.array})`
    case 'Product':
      return `pm.math.prod(${params.array})`
  }
}

module.exports = function (models, activeModel) {
  console.log(`Mr. Compiler: Oh, models again! Active model is ${activeModel} of ${models.length}`)

  let finalCode =
`# PyMC3. WORK IN PROGRESS

import pymc3 as pm
import numpy as np

`
  let modelCodes = []

  // Iteratively get all blocks for the model from all the included models
  function getBlocks (mi) {
    console.log('Get blocks for the model:', models[mi].modelParams.name)
    let resModelsIndexes = []
    let resBlocks = []

    function iter (i) {
      let m = models[i]
      resModelsIndexes.push(i)
      resBlocks = m.blocks.concat(resBlocks)
      if (m.modelParams.include && (m.modelParams.include.length > 0)) {
        m.modelParams.include.forEach(inc => {
          if (resModelsIndexes.indexOf(inc) < 0) {
            iter(inc)
          }
        })
      }
    }

    iter(mi)

    return resBlocks
  }

  /*
    ITERATING OVER ALL PROJECT MODELS
  */
  models.forEach((m, mi) => {
    let code = ''
    // true if we already declared index function in the observer block
    // index function id needed in compiled code to caclulate tensor indexes
    // we don't want it to be declared multiple times
    let indexFunctionDeclared = false

    // List of all named blocks (needed to check for spaces in names)
    let blockNames = []

    // Prepare lists of arrays...
    let dataArrays = []
    let dataTensors = []
    let randomArrays = []
    let randomTensors = []

    m.blocks.forEach(b => {
      if (b.name && b.name.length) {
        // Collect all trimed block names in the array blockNames
        blockNames.push(b.name.trim())
      }
      if (b.typeCode === 2) {
        let dataType = (b.dataType === undefined || b.dataType === '') ? 'auto' : b.dataType
        if (((dataType === 'auto') && (b.value.indexOf(',') >= 0)) || (dataType === 'array')) {
          // Data arrays
          dataArrays.push(b.name)
        } else if (dataType === 'vector' || dataType === 'tensor') {
          // Data tensors
          dataTensors.push(b.name)
        }
      } else if ((b.typeCode === 0) && b.dims && (b.dims.trim() !== '1')) {
        // Multiple random variables:
        if ((b.dims.indexOf(',') < 0) && (parseInt(b.dims) > 1)) {
          // Random array
          randomArrays.push(b.name)
        } else {
          // Random tensor
          randomTensors.push(b.name)
        }
      }
    })

    let allArrays = dataArrays.concat(randomArrays)
    let allTensors = dataTensors.concat(randomTensors)

    // Convert RV distribution parameters object to string
    // If vectorIndex is passed, get arrays and tensors values by index
    function getParams (block, index) {
      const paramObj = block.params || {}
      let paramStr = ''
      if (paramObj) {
        const paramKeys = Object.keys(paramObj).filter(k => (paramObj[k] !== ''))
        paramKeys.forEach((key, i) => {
          // Detect csv with commas and no brackets: add brackets
          let value = ((paramObj[key].indexOf(',') >= 0) && (paramObj[key].indexOf('(') < 0) && (paramObj[key].indexOf('[') < 0))
            ? `np.array([${paramObj[key]}])`
            : paramObj[key]

          /*
          if (index && index.length) {
            // Add indexes to array names
            allArrays.forEach((name) => {
              // Check the name is word and next symbol is not
              const r = new RegExp(`\\b${name}\\b(?!\\[)`, 'g')
              value = value.replace(r, `${name}[${index}]`)
            })

            // Add T.get() to read tensor values
            if (value.indexOf('.get(') < 0) {
              allTensors.forEach((name) => {
                const r = new RegExp(`\\b${name}\\b`)
                value = value.replace(r, `T.get(${name}, ${index})`)
              })
            }
          }
          */

          paramStr += `${translate(key, block.distribution)}=${value}`
          paramStr += `${(i < paramKeys.length - 1) ? ', ' : ''}`
        }) // *paramKeys.forEach
      }
      return (paramStr.length) ? `${paramStr}` : ''
    } // *getParams

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
    let data = ''
    let functionGen = '' // Table function generator
    let functions = '' // Code for all model functions
    let model = 'with pm.Model() as model:\n'

    // Step object needed when dealing with iterative models
    let step = {
      body: '',
      innerList: '_i',
      list: '_i',
      accum: '_i + 1',
      initial: '' + (!isNaN(parseInt(m.modelParams.start)) ? m.modelParams.start : '1')
    }

    let modelOutput = ''
    let observers = ''
    let initializeNeuralNetConverters = false

    // Is it a multistep (multiple iterations) model
    const isMultistepModel = (m.modelParams.steps.length > 0) && (m.modelParams.steps !== '1')
    console.log(`Mr. Compiler: Model "${m.modelParams.name}" has multiple steps (${isMultistepModel})`)

    const blocks = getBlocks(mi)
    console.log('Blocks:', blocks.map(b => b.name))

    /*
      ITERATING OVER ALL BLOCKS OF THE MODEL
    */
    blocks.forEach(b => {
      if (b.typeCode === 0 && b.name.length) {
        // --> RANDOM VARIABLE

        const params = getParams(b)
        let dims = b.hasOwnProperty('dims') ? b.dims.trim() : '1'
        const isMultiDim = dims.indexOf(',') >= 0
        let rvStr
        if (isMultiDim || ((!isMultiDim && (dims !== '1')))) {
          // Tensor or vector
          // Size needed to create array first using mapN
          // When array is created, use Tensor generator
          dims = dims.replace(/(\[|\])/g, '') // remove brackets if present
          if (isMultiDim) {
            rvStr = `${b.name} = pm.${translate(b.distribution)}('${b.name}', ${params}, shape=(${dims}))\n`
          } else {
            rvStr = `${b.name} = pm.${translate(b.distribution)}('${b.name}', ${params}, shape=${dims})\n`
          }
        } else {
          // Scalar
          rvStr = `${b.name} = pm.${translate(b.distribution)}('${b.name}', ${params})\n`
        }
        // Check if we are inside the loop
        if ((isMultistepModel) && (!b.once)) {
          step.body += '\t\t\t' + rvStr
        } else {
          model += '\t' + rvStr
        }
      } else if ((b.typeCode === 1) && b.name.length) {
        // --> EXPRESSION

        // Transform different expression types with params to one expression string
        let transformedValue = (!b.expressionType || (b.expressionType === 'Custom'))
          ? b.value
          : generateExpression(b.expressionType, b.params)

        // Use Deterministic to make PyMC3 track the expression
        if (b.show) {
          transformedValue = `pm.Deterministic('${b.name}', ${transformedValue})`
        }

        // Check if we are inside the loop
        if (isMultistepModel) {
          // Generate a list of accumulators
          step.list += (step.list.length) ? ', ' : ''
          step.list += b.name + ((b.history) ? ', ' + b.name + '_hist' : '')
          step.innerList += (step.innerList.length) ? ', ' : ''
          step.innerList += b.name + ((b.history) ? ', ' + b.name + '_hist' : '')

          // In recursive cycle previous values of expressions and accumulators are underscored (a -> _a)
          // To make them work in code without _ we check if the variable is defined and if not add underscore
          let value = addIterationChecks(transformedValue, blocks)

          step.body += `\t\t\t${b.name} = ${value}\n`
          // Generate accumulator expressions
          step.accum += (step.accum.length ? ',\n' : '') + `${b.name}`
          step.accum += (b.history) ? `,${b.name}_hist: pm.math.concatenate((${b.name}_hist, [${b.name}]))` : ''
          // Generate initial values
          step.initial += (step.initial.length ? ',' : '') + `np.nan`
          // Don't track initial value
          step.initial += (b.history) ? `,[]` : ''
        } else {
          model += `\t${b.name} = ${transformedValue}\n`
        }
      } else if ((b.typeCode === 2) && b.value.length && b.name.length) {
        // --> DATA

        // If value is comma-separated list, add array brackets
        // Upd: check if NaN add brackets
        // Upd: if empty string between ,, - undefined
        let valueStr
        if (b.value.indexOf('[') < 0) {
          if (
            ((b.value.indexOf(',') >= 0) && (b.dataType === 'auto' || b.dataType === '' || b.dataType === undefined)) ||
            (['array', 'vector', 'tensor'].indexOf(b.dataType) >= 0)
          ) {
            // Comma separated values or array or vector or tensor type
            // And no brackets - add brackets
            valueStr = `np.array([${
              b.value.split(',')
                .map(v => v.trim())
                .map(v => !isNaN(v)
                  ? (/* string-number */ v.length ? v : 'np.nan')
                  : (/* string-string */ v.includes('"') ? v : `"${v}"`)
                )
                .join()
            }])`
          } else {
            // No brackets, no commas, no vector, no arrays, no tensors - check if it's a number or boolean
            if (
              (b.dataType !== 'string') &&
              (
                !isNaN(parseInt(b.value)) ||
                (['true', 'false', 'Infinity', 'null', '-Infinity', 'undefined'].indexOf(b.value.trim()) >= 0)
              )
            ) {
              valueStr = b.value.trim()
            } else {
              valueStr = `"${b.value.trim()}"`
            }
          }
        } else {
          // Brackets exist - string or pass as it is
          if (b.dataType === 'string') {
            valueStr = `"${b.value.trim()}"`
          } else {
            valueStr = `np.array(${b.value.trim()})`
          }
        }

        if (b.dataType === 'vector') {
          valueStr = `Vector(${valueStr})`
        } else if (b.dataType === 'tensor' && b.dims && b.dims.length && !isNaN(parseInt(b.dims))) {
          valueStr = `Tensor([${b.dims}], ${valueStr})`
        }
        // Check if it's an external model
        if ((mi !== activeModel) && (b.useAsParameter)) {
          // In external model check if data value is already defined as a parameter
          // Use inner model value as default value in case parameter is missing
          // model = `var ${b.name} = (typeof ${b.name} !== 'undefined') ? ${b.name} : ${valueStr}\n` + model
          data += `${b.name} = (typeof ${b.name} !== 'undefined') ? ${b.name} : ${valueStr}\n`
        } else {
          // Active model: place data on top of model
          // model = `var ${b.name} = ${valueStr}\n` + model
          data += `${b.name} = ${valueStr}\n`
        }
      } else if ((b.typeCode === 3) && b.value.length) {
        // --> ACCUMULATOR

        // Check if we are inside the loop
        if (isMultistepModel) {
          // Generate a list of accumulators
          step.list += (step.list.length) ? ', ' : ''
          step.list += b.name + ((b.history) ? ', ' + b.name + '_hist' : '')
          step.innerList += (step.innerList.length) ? ', ' : ''
          step.innerList += b.name + ((b.history) ? ', ' + b.name + '_hist' : '')

          // Check if expressions or accumulators are defined, if not use previous _value
          let value = addIterationChecks(b.value, blocks)

          // Accumulate value in the step body
          step.body += `\t\t\t_${b.name} = ${b.name}\n`
          step.body += `\t\t\t___${b.name} = ${value}\n`
          if ((b.max && b.max.length) || (b.min && b.min.length)) {
            step.body += `var __${b.name} = _${b.name} + ((___${b.name}) ? ___${b.name} : 0)\n`
            step.body += `var ${b.name} = `

            // Check max/min limits
            if (b.max && b.max.length) {
              step.body += `(__${b.name} > ${b.max}) ? ${b.max} : `
            }
            if (b.min && b.min.length) {
              step.body += `(__${b.name} < ${b.min}) ? ${b.min} : `
            }
            step.body += `__${b.name}\n`
          } else {
            step.body += `\t\t\t${b.name} = _${b.name} + (___${b.name} if ___${b.name} else 0)\n`
          }
          // Generate accumulator return in recursion function
          step.accum += (step.accum.length ? ',' : '') + `${b.name}`
          step.accum += (b.history) ? `,pm.math.concatenate((${b.name}_hist, [${b.name}]))` : ''
          // Generate initial values
          step.initial += (step.initial.length ? ',' : '') + `${b.initialValue}`
          // Don't track initial value
          // step.initial += (b.history) ? `,\n${b.name}_hist: [${b.initialValue}]` : ''
          step.initial += (b.history) ? `,[]` : ''
        } else {
          model += `${b.name} = ${b.initialValue} + ${b.value}\n`
        }
      } else if ((b.typeCode === 7) && b.name && b.name.length && b.x && b.x.length && b.y && b.y.length) {
        if (b.tableFunction) {
          if (functionGen === '') {
            functionGen = `
var functionGen = function(xarr, yarr) {
  return function(x) {
    if ((x === x) && (x !== null) && (x !== undefined)) {
      var it = function (i) {
        if (((i === 0) && (x <= xarr[i])) || ((x > xarr[i]) && (i === xarr.length - 2)) || ((x >= xarr[i]) && (x < xarr[i + 1]))) {
          return i
        } else {
          return it(i + 1)
        }
      }
      var i1 = it(0)
      var i2 = i1 + 1
      var y = (yarr[i2] - yarr[i1]) * (x - xarr[i1]) / (xarr[i2] - xarr[i1]) + yarr[i1]
      return ${((b.max !== undefined) && !isNaN(parseFloat(b.max))) ? `(y > ${b.max}) ? ${b.max} :` : ``}${((b.min !== undefined) && !isNaN(parseFloat(b.min))) ? `(y < ${b.min}) ? ${b.min} :` : ``}y
    } else {
      return undefined
    }
  }
}
`
          }
          functions += `
var ${b.name.trim()} = functionGen([${b.x}],[${b.y}])
`
        } else {
          functions += `
var ${b.name.trim()} = function (${b.x.trim()}) {
return ${b.y.trim()}
}
`
        }
      } else if ((b.typeCode === 6) && b.layers.length) {
        // --> NEURAL NET
        var layers = ''
        b.layers.slice().reverse().forEach((l, li) => {
          if (li > 0) {
            layers += ',\n'
          }
          if (l.type === 'affine') {
            layers += `affine('${l.name}', {in: ${l.in}, out: ${l.out}})`
          } else {
            layers += l.type
          }
        })
        if (b.convert) {
          initializeNeuralNetConverters = true
          layers = `convertOut,\n${layers},\nconvertIn`
        }
        var stack = ((b.layers.length > 1) || (b.convert)) ? `stack([\n${layers}\n])` : layers
        model += `var ${b.name} = ${stack}\n`
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

        // Remove white spaces
        let value = b.value.trim()

        // Convert observer distribution params to string
        let params = getParams(b)

        // Check if the value is scalar or vector
        if (isVector(value) && (value.indexOf('[') < 0)) {
          value = `np.array([${value.trim()}])`
        }
        observer += `obs = pm.${translate(b.distribution)}('obs', ${params}, observed=${value})\n`

        // Add observer code later, if in the loop
        if (isMultistepModel) {
          observers += '\t' + observer
        } else {
          model += '\t' + observer
        }
      } else if ((b.typeCode === 5) && (b.value) && (b.value.length)) {
        // --> CONDITION BLOCK
        console.log(b)
        const cond = `\tpm.Potential('cond-${b.id}', pm.math.switch(${b.value}, 0, -100))\n`
        if (isMultistepModel) {
          observers += cond
        } else {
          model += cond
        }
      }

      // End of blocks types. Finish compilation
      // Add needed block names to the model output

      if (
        b.name &&
        b.show &&
        (m.blocks.map(bl => bl.name).indexOf(b.name) >= 0) &&
        (
          // Multi step simulation - output only what we can
          ((isMultistepModel) && (((b.typeCode === 0) && b.once) || (b.typeCode === 1) || (b.typeCode === 2) || (b.typeCode === 3))) ||
          // One step - output all we want
          (!isMultistepModel)
        )
      ) { // Return variables
        modelOutput += b.name + ',' + ((b.history && isMultistepModel) ? b.name + '_hist,' : '')
      }
    }) // End of block iterator

    // Generate steps add observers after iterator
    if (isMultistepModel) {
      model +=
`\tdef step (n):
\t\tif n > 0:
\t\t\t(${step.innerList}) = step(n - 1)
${step.body}\t\t\treturn (${step.accum})
\t\telse:
\t\t\treturn (${step.initial})

\t(${step.list}) = step(${m.modelParams.steps})
`
      model += observers
    }

    // Sampling
    /*
    model += '\t' + `trace = pm.sample()\n`
    */

    code += data + functionGen + functions + model

    // Add helper functions
    // Convert Neural Net layers from/to tesors
    if (initializeNeuralNetConverters) {
      const fIn =
`var convertIn = function convertIn (_x) {
  if (typeof _x === 'number') {
    return Tensor([1,1],[_x])
  } else if (Array.isArray(_x)) {
    return Vector(_x)
  } else {
    return _x
  }
}\n`
      const fOut =
`var convertOut = function convertOut (_x) {
  var _xout = T.toScalars(_x)
  if (_xout.length === 0) {
    return undefined
  } else if (_xout.length === 1) {
    return _xout[0]
  } else {
    return _xout
  }
}\n`
      code = fIn + fOut + code
    }

    // Sampling (Inference)
    let inf = (mi === activeModel) ? '' : 'return '
    if (
      (m.modelParams.method === 'deterministic') ||
      ((m.modelParams.method === 'auto') && (!m.blocks.find(b => [0, 4, 5, 6].includes(b.typeCode))))
    ) {
      inf += `\tresult = model()\n`
    } else if (['auto', 'enumerate', 'rejection', 'incrementalMH', 'forward'].includes(m.modelParams.method)) {
      // Fallback to automatic inference
      inf += `\tresult = pm.sample(model=model)\n`
    } else {
      let paramStr = ''

      // Iterate over all method params
      Object.keys(m.methodParams).forEach(key => {
        // Check if param is not empty and needed for current method
        if (
          m.methodParams[key] &&
          !['lag'].includes(key) && // PyMC3 doesn't use lags
          (m.methodParams[key] !== '') &&
          methods[m.modelParams.method].params.hasOwnProperty(key) &&
          !((m.modelParams.method === 'optimize') && (key === 'samples')) // we don't pass samples to optimizer
        ) {
          paramStr += `, ${translate(key)}=${m.methodParams[key]}`
          // Instead of providing a lag argument, calculate number of samples
          if ((key === 'samples') && m.methodParams.lag && (parseInt(m.methodParams.lag) > 0)) {
            paramStr += '*' + m.methodParams.lag
          }
        }
      })
      /*
      if (m.modelParams.method === 'HMC') {
        kernelStr = (kernelParamStr.length) ? `, kernel: {HMC: {${kernelParamStr}}}` : `, kernel: 'HMC'`
      } else if (m.modelParams.method === 'optimize') {
        kernelStr = (kernelParamStr.length) ? `, optMethod: {${m.methodParams.optMethod || 'adam'}: {${kernelParamStr}}}` : `, optMethod: '${m.methodParams.optMethod || 'adam'}'`
      }
      */
      if (m.modelParams.method === 'optimize') {
        inf += `\tresult = pm.fit(model=model${paramStr}).sample(${m.methodParams.samples})\n`
      } else {
        inf += `\tresult = pm.sample(model=model, step=pm.${translate(m.modelParams.method)}()${paramStr})\n`
      }
    }
    code += inf
    code += (mi === activeModel) ? `` : `}` // Finish the function if it's not a main model

    // Traceplot
    if (modelOutput.length) {
      modelOutput = modelOutput.slice(0, -1)
      code += `pm.traceplot(result, varnames=['${modelOutput.split(',').join('\',\'')}']);\n`
    } else {
      code += `pm.traceplot(result);\n`
    }

    // Replace all spaces in block names with underscores
    code = spacesToUnderscores(code, blockNames)

    if (mi === activeModel) {
      modelCodes.push(code)
      finalCode += code + '\n'
    } else {
      modelCodes.push(code)
    }
  }) // *models.forEach

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

  console.log(`Mr. Compiler: I've finished. Here's your PYMC3 code:%c\n${finalCode}`, `color: #2C893A; font-size:10px;`)
  return finalCode
}
