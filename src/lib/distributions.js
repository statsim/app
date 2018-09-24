module.exports = {
  'Bernoulli': {
    p: {
      type: 'real',
      min: 0,
      max: 1
    }
  },
  'Beta': {
    a: {
      type: 'real',
      min: 0,
      max: Infinity
    },
    b: {
      type: 'real',
      min: 0,
      max: Infinity
    }
  },
  'Binomial': {
    p: {
      type: 'real',
      min: 0,
      max: 1
    },
    n: {
      type: 'int',
      min: 1,
      max: Infinity
    }
  },
  'Categorical': {
    ps: {
      type: 'vector'
    },
    vs: {
      type: 'vector'
    }
  },
  'Cauchy': {
    location: {
      type: 'real'
    },
    scale: {
      type: 'real',
      min: 0,
      max: Infinity
    }
  },
  'Dirichlet': {
    alpha: {
      type: 'vector'
    }
  },
  'Discrete': {
    ps: {
      type: 'vector'
    }
  },
  'Exponential': {
    a: {
      type: 'real',
      min: 0,
      max: Infinity
    }
  },
  'Gamma': {
    shape: {
      type: 'real',
      min: 0,
      max: Infinity
    },
    scale: {
      type: 'real',
      min: 0,
      max: Infinity
    }
  },
  'Gaussian': {
    mu: {
      type: 'real'
    },
    sigma: {
      type: 'real',
      min: 0,
      max: Infinity
    }
  },
  'Uniform': {
    a: {
      type: 'real'
    },
    b: {
      type: 'real'
    }
  }
}
