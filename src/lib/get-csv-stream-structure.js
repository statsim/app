const lineParser = require('csv-parse/lib/sync')

function count (substr, str) {
  return (str.match(new RegExp(substr, 'g')) || []).length
}

function findDelimiter (delimiters, str) {
  var delimiter = ','
  var counter = 0
  delimiters.forEach((d) => {
    var c = count(d, str)
    if (c > counter) {
      counter = c
      delimiter = d
    }
  })
  return delimiter
}

function getCsvStreamStructure (rs, extra, cb) {
  var head = '' // some bytes of the file
  var delimiters = [',', '\t', ';']
  rs.on('readable', function () {
    if (head.length === 0) {
      var isFirstLine = true
      while (isFirstLine) {
        var chunk = rs.read(1)
        head += chunk
        if (chunk === '\n') {
          isFirstLine = false
        }
      }
      rs.unshift(head) // throw back the readed chunk to the buffer.
      var delimiter = (extra && extra.length) ? extra : findDelimiter(delimiters, head)
      cb(lineParser(head.slice(0, -1), {delimiter: delimiter})[0], delimiter)
    }
  })
}

module.exports = getCsvStreamStructure
