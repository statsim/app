// module.exports = {
  // 'Custom': ['expression'],
  // 'Length': ['input'],
  // 'Reduce product': ['input'],
  // 'Reduce sum': ['input'],
  // 'Reduce mean': ['input'],
  // 'If..Else': ['condition', 'true', 'false']
// }

module.exports = Object.assign({},
  require('./expressionsCustom'),
  require('./expressionsLogic'),
  require('./expressionsList'),
  require('./expressionsMath'),
)