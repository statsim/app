module.exports = function (name) {
  return {
    modelParams: {
      name,
      description: '',
      steps: 1,
      method: 'deterministic',
      include: []
    },
    blocks: [],
    methodParams: {
      chains: 1,
      samples: 1000
    }
  }
}
