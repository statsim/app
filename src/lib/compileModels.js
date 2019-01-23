const methods = require('./methods')

module.exports = function (models, activeModel) {
  console.log(`Mr. Compiler: Oh, models again! Active model is ${activeModel} of ${models.length}`)

  let finalCode = ''
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

    // Prepare lists of arrays...
    const dataArrays = []
    const dataTensors = []
    const randomArrays = []
    const randomTensors = []

    m.blocks.forEach(b => {
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

    const allArrays = dataArrays.concat(randomArrays)
    const allTensors = dataTensors.concat(randomTensors)

    // Convert RV distribution parameters object to string
    // If vectorIndex is passed, get arrays and tensors values by index
    function getParams (paramObj, index) {
      let paramStr = ''
      if (paramObj) {
        const paramKeys = Object.keys(paramObj).filter(k => (paramObj[k] !== ''))
        paramKeys.forEach((key, i) => {
          // Detect csv with commas and no brackets: add brackets
          let value = ((paramObj[key].indexOf(',') >= 0) && (paramObj[key].indexOf('(') < 0) && (paramObj[key].indexOf('[') < 0))
            ? `[${paramObj[key]}]`
            : paramObj[key]

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

          paramStr += `${key}: ${value}`
          paramStr += `${(i < paramKeys.length - 1) ? ', ' : ''}`
        }) // *paramKeys.forEach
      }
      return (paramStr.length) ? `{${paramStr}}` : ''
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
    let model = 'var model = function () {\n'

    // Step object needed when dealing with iterative models
    let step = {
      body: '',
      innerList: '_i',
      list: '_i',
      accum: '_i: _i + 1',
      initial: '_i: ' + (!isNaN(parseInt(m.modelParams.start)) ? m.modelParams.start : '1')
    }

    let modelOutput = ''
    let observers = ''
    let initializeNeuralNetConverters = false

    const blocks = getBlocks(mi)
    console.log('Blocks:', blocks.map(b => b.name))

    /*
      ITERATING OVER ALL BLOCKS OF THE MODEL
    */
    blocks.forEach(b => {
      if (b.typeCode === 0 && b.name.length) {
        // --> RANDOM VARIABLE

        const params = getParams(b.params)
        let dims = b.hasOwnProperty('dims') ? b.dims.trim() : '1'
        const isMultiDim = dims.indexOf(',') >= 0
        const sampleStr = `sample(${b.distribution}(${params}))`
        let rvStr = ''
        if (isMultiDim || ((!isMultiDim && (dims !== '1')))) {
          // Tensor or vector
          // Size needed to create array first using mapN
          // When array is created, use Tensor generator
          let size = isMultiDim
            ? dims.replace(',', '*')
            : dims // Original dim
          size = size.replace(/(\[|\])/g, '') // remove brackets if present
          const arrayStr = `mapN(function (_j) { return ${sampleStr}}, ${size})`
          if (isMultiDim) {
            dims = (dims.indexOf('[') < 0) ? `[${dims}]` : dims
            rvStr = `var ${b.name} = Tensor(${dims}, ${arrayStr})\n`
          } else {
            rvStr = `var ${b.name} = ${arrayStr}\n`
          }
        } else {
          // Scalar
          rvStr = `var ${b.name} = ${sampleStr}\n`
        }
        // Check if we are inside the loop
        if ((m.modelParams.steps > 1.5) && (!b.once)) {
          step.body += rvStr
        } else {
          model += rvStr
        }
      } else if ((b.typeCode === 1) && b.value.length && b.name.length) {
        // --> EXPRESSION

        // Check if we are inside the loop
        if (m.modelParams.steps > 1.5) {
          // Generate a list of accumulators
          step.list += (step.list.length) ? ', ' : ''
          step.list += b.name + ', _' + b.name + ((b.history) ? ', ' + b.name + '_hist' : '')
          step.innerList += (step.innerList.length) ? ', ' : ''
          step.innerList += '_' + b.name + ((b.history) ? ', ' + b.name + '_hist' : '')
          // Calculate expression in the body
          let value = b.value
          blocks.forEach(bb => {
            if ((bb.typeCode === 1) || (bb.typeCode === 3)) {
              console.log('Check block name: ', bb.name)
              const r = new RegExp(`\\b${bb.name}\\b`, 'g')
              value = value.replace(r, `(typeof ${bb.name} !== 'undefined' ? ${bb.name} : _${bb.name})`)
            }
          })
          console.log('Original: ', b.value)
          console.log('Upd:', value)

          step.body += `var ${b.name} = ${value}\n`
          // Generate accumulator expressions
          step.accum += (step.accum.length ? ',\n' : '') + `${b.name}: ${b.name}`
          step.accum += `,\n_${b.name}: ${b.name}`
          step.accum += (b.history) ? `,\n${b.name}_hist: ${b.name}_hist.concat(${b.name})` : ''
          // Generate initial values
          step.initial += (step.initial.length ? ',\n' : '') + `${b.name}: undefined`
          step.initial += `,\n_${b.name}: undefined`
          // Don't track initial value
          step.initial += (b.history) ? `,\n${b.name}_hist: []` : ''
        } else {
          model += `var ${b.name} = ${b.value}\n`
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
            valueStr = `[${
              b.value.split(',')
                .map(v => v.trim())
                .map(v => !isNaN(v)
                  ? (/* string-number */ v.length ? v : 'undefined')
                  : (/* string-string */ v.includes('"') ? v : `"${v}"`)
                )
                .join()
            }]`
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
            valueStr = b.value.trim()
          }
        }

        // Fix too much recursion bug
        valueStr = `JSON.parse('{"data": ${valueStr}}').data`

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
          data += `var ${b.name} = (typeof ${b.name} !== 'undefined') ? ${b.name} : ${valueStr}\n`
        } else {
          // Active model: place data on top of model
          // model = `var ${b.name} = ${valueStr}\n` + model
          data += `var ${b.name} = ${valueStr}\n`
        }
      } else if ((b.typeCode === 3) && b.value.length) {
        // --> ACCUMULATOR

        // Check if we are inside the loop
        if (m.modelParams.steps > 1.5) {
          // Generate a list of accumulators
          step.list += (step.list.length) ? ', ' : ''
          step.list += b.name + `, _` + b.name + ((b.history) ? ', ' + b.name + '_hist' : '')
          step.innerList += (step.innerList.length) ? ', ' : ''
          step.innerList += `_` + b.name + ((b.history) ? ', ' + b.name + '_hist' : '')

          let value = b.value
          blocks.forEach(bb => {
            if ((bb.typeCode === 1) || (bb.typeCode === 3)) {
              console.log('Check block name: ', bb.name)
              const r = new RegExp(`\\b${bb.name}\\b`, 'g')
              value = value.replace(r, `(typeof ${bb.name} !== 'undefined' ? ${bb.name} : _${bb.name})`)
            }
          })

          // Accumulate value in the step body
          step.body += `var ___${b.name} = ${value}\n`
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
            step.body += `var ${b.name} = _${b.name} + ((___${b.name}) ? ___${b.name} : 0)\n`
          }
          // Generate accumulator return in recursion function
          step.accum += (step.accum.length ? ',\n' : '') + `${b.name}: ${b.name}`
          step.accum += `,\n_${b.name}: ${b.name}`
          step.accum += (b.history) ? `,\n${b.name}_hist: ${b.name}_hist.concat(${b.name})` : ''
          // Generate initial values
          step.initial += (step.initial.length ? ',\n' : '') + `${b.name}: ${b.initialValue}`
          step.initial += `,\n_${b.name}: ${b.initialValue}`
          // Don't track initial value
          // step.initial += (b.history) ? `,\n${b.name}_hist: [${b.initialValue}]` : ''
          step.initial += (b.history) ? `,\n${b.name}_hist: []` : ''
        } else {
          model += `var ${b.name} = ${b.initialValue} + ${b.value}\n`
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

        // Check if the value is scalar or vector
        if (isNumber(value) || isScalarData(value)) {
          // Scalar
          // Convert observer distribution params to string
          let params = getParams(b.params)
          observer += `observe(${b.distribution}(${params}), ${b.value})\n`
        } else if (isVector(value) || isVectorData(value)) {
          // Vector
          let params = getParams(b.params, '_j')
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
          let params = getParams(b.params, '_j')
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
        b.name &&
        b.show &&
        (m.blocks.map(bl => bl.name).indexOf(b.name) >= 0) &&
        (
          // Multi step simulation - output only what we can
          ((m.modelParams.steps > 1.5) && (((b.typeCode === 0) && b.once) || (b.typeCode === 1) || (b.typeCode === 2) || (b.typeCode === 3))) ||
          // One step - output all we want
          (m.modelParams.steps < 1.5)
        )
      ) { // Return variables
        modelOutput += b.name + ', ' + ((b.history && m.modelParams.steps > 1.5) ? b.name + '_hist, ' : '')
      }
    }) // End of block iterator

    // Generate steps add observers after iterator
    if (m.modelParams.steps > 1.5) {
      model +=
`var step = function (n) {
if (n > 0) {
var {${step.innerList}} = step(n - 1)
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
    } else {
      // Model returns nothing
      model += `return 0\n`
    }
    model += '}\n'
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

    // Inference
    let inf = (mi === activeModel) ? '' : 'return '
    if (m.modelParams.method === 'deterministic') {
      inf += `model()\n`
    } else {
      let paramStr = ''
      let kernelStr = ''
      let kernelParamStr = ''
      let realMethod = (m.modelParams.method === 'HMC') ? 'MCMC' : m.modelParams.method

      // Iterate over all method params
      Object.keys(m.methodParams).forEach(key => {
        // Check if param is not empty
        if (m.methodParams[key] && m.methodParams[key] !== '' && methods[m.modelParams.method].params.hasOwnProperty(key)) {
          if (((key === 'steps') && (m.modelParams.method === 'HMC')) || key === 'stepSize') {
            kernelParamStr += (kernelParamStr.length) ? ', ' : ''
            kernelParamStr += `${key}: ${m.methodParams[key]}`
          } else if (key !== 'optMethod') {
            paramStr += `, ${key}: ${m.methodParams[key]}`
          }
        }
      })
      if (m.modelParams.method === 'HMC') {
        kernelStr = (kernelParamStr.length) ? `, kernel: {HMC: {${kernelParamStr}}}` : `, kernel: 'HMC'`
      } else if (m.modelParams.method === 'optimize') {
        kernelStr = (kernelParamStr.length) ? `, optMethod: {${m.methodParams.optMethod || 'adam'}: {${kernelParamStr}}}` : `, optMethod: '${m.methodParams.optMethod || 'adam'}'`
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

  console.log(`Mr. Compiler: I've finished. Here's your WebPPL code:%c\n${finalCode}`, `color: #2C893A; font-size:10px;`)
  return finalCode
}
