const flat = require('flat')
const through2 = require('through2') // Transform stream

// Filter object stream (range)
module.exports = function flatObjectStream () {
  return through2.obj(function (obj, enc, callback) {
    this.push(flat(obj))
    callback()
  })
}
