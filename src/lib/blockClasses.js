class Block {
  constructor () {
    this.id = 'b' + Math.round(Math.random() * 100000000)
  }
}

module.exports = [
  class RandomVariable extends Block {
    constructor (counter) {
      super()
      this.distribution = 'Uniform'
      this.name = 'R' + counter
      this.once = false
      this.params = {}
      this.show = false
      this.type = 'Random Variable'
      this.typeCode = 0
      this.dims = '1'
      this.units = ''
    }
  },
  class Expression extends Block {
    constructor (counter) {
      super()
      this.name = 'E' + counter
      this.history = false
      this.show = true
      this.type = 'Expression'
      this.typeCode = 1
      this.expressionType = 'Custom'
      this.params = {}
      this.value = ''
      this.units = ''
    }
  },
  class Data extends Block {
    constructor (counter, data) {
      super()
      this.name = (typeof counter === 'string') ? counter : 'D' + counter
      this.show = false
      this.type = 'Data'
      this.typeCode = 2
      this.useAsParameter = false // Name is a parameter for the model when called externally
      this.dims = '' // Tensor dimensions
      if (data && Array.isArray(data)) {
        this.value = data.join()
      } else if (data && (typeof data === 'string')) {
        this.value = data
      } else {
        this.value = ''
      }
      this.units = ''
      this.dataType = ''
      this.dataCategories = ''
    }
  },
  class Accumulator extends Block {
    constructor (counter) {
      super()
      this.initialValue = 0
      this.history = false
      this.name = 'A' + counter
      this.show = true
      this.type = 'Accumulator'
      this.typeCode = 3
      this.value = ''
      this.min = ''
      this.max = ''
      this.units = ''
    }
  },
  class Observer extends Block {
    constructor (counter) {
      super()
      this.distribution = 'Gaussian'
      this.params = {}
      this.type = 'Observer'
      this.typeCode = 4
      this.value = ''
    }
  },
  class Condition extends Block {
    constructor (counter) {
      super()
      this.type = 'Condition'
      this.typeCode = 5
      this.value = ''
    }
  },
  class NeuralNet extends Block {
    constructor (counter) {
      super()
      this.name = 'N' + counter
      this.type = 'Neural Net'
      this.typeCode = 6
      this.layers = []
      this.convert = false
    }
  },
  class Func extends Block {
    constructor (counter) {
      super()
      this.name = 'F' + counter
      this.type = 'Function'
      this.typeCode = 7
      this.x = ''
      this.y = ''
      this.min = ''
      this.max = ''
      this.tableFunction = false
    }
  }
]
