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
        table: true,
        type
      },
      data: [],
      loading: false,
      preview: false,
      pipeline: {
        source: {
          type: 'none',
          format: '',
          url: '',
          file: '',
          dataframe: '',
          stream: null
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
        },
        processed: 0,
        progress: 0
      },
      methodParams: {
        chains: 1,
        samples: 1000
      }
    }
  } else if (type && (type === 'tf')) {
    return {
      modelParams: {
        name,
        description: '',
        steps: 1,
        method: 'deterministic',
        include: [],
        table: false,
        customCode: '',
        type
      },
      blocks: [],
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
        table: false,
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
