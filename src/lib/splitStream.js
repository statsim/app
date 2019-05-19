var split = require('split')
var xmlNodes = require('xml-nodes')

module.exports = function (streamType, xmlRepeatedNode) {
  return (streamType === 'csv')
    ? split(function (line) {
      return line + '\n'
    })
    : xmlNodes(xmlRepeatedNode)
}
