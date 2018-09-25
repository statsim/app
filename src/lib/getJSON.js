const request = new window['XMLHttpRequest']()

module.exports = (url, cb, err) => {
  request.open('GET', url, true)

  request.onload = function () {
    if (request.status >= 200 && request.status < 400) {
      cb(JSON.parse(request.responseText))
    } else {
      if (err) err(request.status)
    }
  }

  request.onerror = function () {
    if (err) err(request.status)
  }

  request.send()
}
