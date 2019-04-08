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
  'Delta': {
    v: {
      type: 'real'
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
  'KDE': {
    data: {
      type: 'vector'
    },
    width: {
      type: 'real',
      min: 0,
      max: Infinity
    }
  },
  'Laplace': {
    location: {
      type: 'real'
    },
    scale: {
      type: 'real',
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
      type: 'real'
    },
    sigma: {
      type: 'real',
      min: 0,
      max: Infinity
    },
    a: {
      type: 'real'
    },
    b: {
      type: 'real'
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
      type: 'real',
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
  'TensorGaussian': {
    mu: {
      type: 'real'
    },
    sigma: {
      type: 'real',
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
      type: 'real',
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
      type: 'real'
    },
    b: {
      type: 'real'
    }
  }
}
