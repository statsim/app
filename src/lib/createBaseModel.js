module.exports = function (name, type) {
  if (type && (type === 'dataframe')) {
    return {
      modelParams: {
        name,
        description: '',
        steps: 1,
        method: 'deterministic',
        include: [],
        customCode: '',
        type
      },
      blocks: [],
      data: [],
      loading: false,
      pipeline: {
        source: {
          type: 'none',
          url: '',
          file: '',
          dataframe: ''
        },
        parse: {
          delimiter: '',
          hasHeader: true,
          customHeader: '',
          comment: ''
        },
        structure: {
          columns: [],
          showAll: true
        },
        filters: [],
        output: {
          toMemory: true,
          toStream: false,
          format: 'csv'
        }
      },
      methodParams: {
        chains: 1,
        samples: 1000
      }
    }
  } else {
    return {
      modelParams: {
        name,
        description: '',
        steps: 1,
        method: 'deterministic',
        include: [],
        customCode: ''
      },
      blocks: [],
      methodParams: {
        chains: 1,
        samples: 1000
      }
    }
  }
}
