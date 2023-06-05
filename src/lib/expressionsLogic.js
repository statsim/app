module.exports = {
  'And': {
    'a': { type: 'boolean' },
    'b': { type: 'boolean' }
  },
  'Or': {
    'a': { type: 'boolean' },
    'b': { type: 'boolean' }
  },
  'Not': {
    'a': { type: 'boolean' }
  },
  'Equal': {
    'a': { type: 'float' },
    'b': { type: 'float' }
  },
  'Not equal': {
    'a': { type: 'float' },
    'b': { type: 'float' }
  },
  'Greater than': {
    'a': { type: 'float' },
    'b': { type: 'float' }
  },
  'Greater than or equal': {
    'a': { type: 'float' },
    'b': { type: 'float' }
  },
  'Less than': {
    'a': { type: 'float' },
    'b': { type: 'float' }
  },
  'Less than or equal': {
    'a': { type: 'float' },
    'b': { type: 'float' }
  },
  'If..Else': {
    'condition': {
      type: 'boolean'
    },
    'true': {
      type: 'float'
    },
    'false': {
      type: 'float'
    }
  }
}