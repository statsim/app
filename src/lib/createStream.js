const ReadStream = require('filestream').read
const http = require('stream-http')
// const Readable = require('stream').Readable

// Creates a stream based on file object or url

module.exports = createStream

function createStream (f) {
  console.log('[Create stream] Hi!')
  return new Promise((resolve, reject) => {
    let stream
    if (f.size) {
      // File
      console.log(`[Create stream] File of size: ${f.size}B`)
      stream = new ReadStream(f, {chunkSize: 102400})
      stream.setEncoding('utf8')
      resolve(stream)
    } else if (f.length) {
      // const request =
      // 1st request
      console.log(`[Create stream] Url: ${f}`)
      const request = http.get(f, function (res) {
        if (res.statusCode === 200) {
          stream = res
          stream.setEncoding('utf8')
          resolve(stream)
        } else {
          // Error during 1st request
          console.log('[Error]', res.statusCode, res.statusMessage)
        }
      })
      request.on('error', function (e) {
        console.log('[Event][Error]', e)
        console.log('[Next] Trying to bypass CORS')
        const fcors = 'https://cors-anywhere.herokuapp.com/' + f
        // 2nd request
        const request2 = http.get(fcors, function (res2) {
          if (res2.statusCode === 200) {
            stream = res2
            stream.setEncoding('utf8')
            resolve(stream)
          } else {
            console.log('[Error]', res2.statusCode, res2.statusMessage)
          }
        })
        request2.on('error', function (e) {
          reject(e)
          // reject(new Error(res2.statusMessage))
        })
      })
    } /* else if (f.modelParams) {
      // Dataframe
      const model = f
      console.log(`[Create stream] Dataframe: ${model.modelParams.name}`)
      const stream = Readable()
      stream.setEncoding('utf8')
      var c = 97
      stream._read = function () {
        stream.push(String.fromCharCode(c++))
        if (c > 'z'.charCodeAt(0)) stream.push(null)
      }
      resolve(stream)
    } */
  })
}
