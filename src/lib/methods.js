const samples = {
  type: 'int',
  min: 0,
  max: Infinity,
  default: 1000,
  description: 'The number of samples to take'
}

const lag = {
  type: 'int',
  default: 0,
  min: 0,
  description: 'The number of additional iterations between samples'
}

const burn = {
  type: 'int',
  default: 0,
  min: 0,
  description: 'The number of additional iterations before collecting samples'
}

const onlyMAP = {
  type: 'boolean',
  default: false,
  description: 'Retain sample with the highest score'
}

module.exports = {
  'deterministic': {
    name: 'Deterministic',
    params: {}
  },
  'enumerate': {
    name: 'Enumeration',
    params: {
      maxExecutions: {
        type: 'int',
        min: 0,
        max: Infinity,
        default: Infinity,
        description: 'Max number of executions'
      },
      strategy: {
        type: 'select',
        values: ['likelyFirst', 'depthFirst', 'breadthFirst'],
        default: 'depthFirst',
        description: 'The traversal strategy'
      }
    }
  },
  'rejection': {
    name: 'Rejection Sampling',
    params: {
      samples,
      maxScore: {
        type: 'real',
        default: 0,
        description: 'An upper bound on the total factor score per-execution'
      },
      incremental: {
        type: 'boolean',
        default: false,
        description: 'Enable incremental mode'
      }
    }
  },
  'MCMC': {
    name: 'MCMC',
    params: {
      samples,
      lag,
      burn,
      onlyMAP
    }
  },
  'HMC': {
    name: 'HMC',
    params: {
      samples,
      lag,
      burn,
      steps: {
        type: 'int',
        min: 0,
        default: 5,
        description: 'The number of HMC steps to take per-iteration'
      },
      stepSize: {
        type: 'real',
        min: 0,
        default: 0.1,
        description: 'The size of each HMC step'
      },
      onlyMAP
    }
  },
  'incrementalMH': {
    name: 'Incremental MH',
    params: {
      samples,
      lag,
      burn,
      onlyMAP
    }
  },
  'SMC': {
    name: 'Sequential MC',
    params: {
      particles: {
        type: 'int',
        min: 0,
        default: 100,
        description: 'The number of particles to simulate'
      },
      rejuvSteps: {
        type: 'int',
        min: 0,
        default: 0,
        description: 'The number of MCMC steps to apply to each particle'
      },
      rejuvKernel: {
        type: 'select',
        values: ['MH', 'HMC'],
        default: 'MH',
        description: 'The MCMC kernel to use for rejuvenation'
      },
      importance: {
        type: 'select',
        values: ['default', 'ignoreGuide', 'autoGuide'],
        default: 'default',
        description: 'The MCMC kernel to use for rejuvenation'
      },
      onlyMAP
    }
  },
  'optimize': {
    name: 'Optimization',
    params: {
      samples,
      onlyMAP
    }
  },
  'forward': {
    name: 'Forward Sampling',
    params: {
      samples,
      onlyMAP
    }
  }
}