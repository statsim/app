module.exports = {
  'Bernoulli': {
    p: {
      type: 'float',
      min: 0,
      max: 1
    }
  },
  'Beta': {
    a: {
      type: 'float',
      min: 0,
      max: Infinity
    },
    b: {
      type: 'float',
      min: 0,
      max: Infinity
    }
  },
  'Binomial': {
    p: {
      type: 'float',
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
      type: 'float'
    },
    scale: {
      type: 'float',
      min: 0,
      max: Infinity
    }
  },
  'Delta': {
    v: {
      type: 'float'
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
      type: 'float',
      min: 0,
      max: Infinity
    }
  },
  'Gamma': {
    shape: {
      type: 'float',
      min: 0,
      max: Infinity
    },
    scale: {
      type: 'float',
      min: 0,
      max: Infinity
    }
  },
  'Gaussian': {
    mu: {
      type: 'float'
    },
    sigma: {
      type: 'float',
      min: 0,
      max: Infinity
    }
  },
  'KDE': {
    data: {
      type: 'vector'
    },
    width: {
      type: 'float',
      min: 0,
      max: Infinity
    }
  },
  'Laplace': {
    location: {
      type: 'float'
    },
    scale: {
      type: 'float',
      min: 0,
      max: Infinity
    }
  },
  'LogisticNormal': {
    mu: {
      type: 'vector'
    },
    sigma: {
      type: 'vector'
    }
  },
  'LogitNormal': {
    mu: {
      type: 'float'
    },
    sigma: {
      type: 'float',
      min: 0,
      max: Infinity
    },
    a: {
      type: 'float'
    },
    b: {
      type: 'float'
    }
  },
  /*
  // Currently unavailable
  // It takes an array of distributions, but we can't generate
  'Mixture': {
    dists: {
      type: 'vector'
    },
    ps: {
      type: 'vector'
    }
  },
  */
  'Multinomial': {
    ps: {
      type: 'vector'
    },
    n: {
      type: 'int',
      min: 1
    }
  },
  'MultivariateBernoulli': {
    ps: {
      type: 'vector'
    }
  },
  'MultivariateGaussian': {
    mu: {
      type: 'vector'
    },
    cov: {
      type: 'vector'
    }
  },
  'Poisson': {
    mu: {
      type: 'float',
      min: 0,
      max: Infinity
    }
  },
  'RandomInteger': {
    n: {
      type: 'int',
      min: 0,
      max: Infinity
    }
  },
  'StudentT': {
    df: {
      type: 'float',
      min: 0,
      max: Infinity
    },
    location: {
      type: 'float'
    },
    scale: {
      type: 'float',
      min: 0,
      max: Infinity
    }
  },
  'TensorGaussian': {
    mu: {
      type: 'float'
    },
    sigma: {
      type: 'float',
      min: 0,
      max: Infinity
    },
    dims: {
      type: 'vector',
      min: 0,
      max: Infinity
    }
  },
  'TensorLaplace': {
    location: {
      type: 'vector'
    },
    scale: {
      type: 'float',
      min: 0,
      max: Infinity
    },
    dims: {
      type: 'vector',
      min: 0,
      max: Infinity
    }
  },
  'Uniform': {
    a: {
      type: 'float'
    },
    b: {
      type: 'float'
    }
  }
}
