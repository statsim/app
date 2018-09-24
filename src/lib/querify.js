'use strict'

const queryString = require('query-string')
const escape = require('html-escape')
const is = require('is')
      is.json = require('is-json')

module.exports = Querify

function Querify(keys) {
  if (!(this instanceof Querify)) return new Querify()
  this.keys = keys
}

Querify.prototype.getQueryString = function(obj) {
  var queryObj = {}
  this.keys.forEach((key)=>{
    var val = obj[key]
    if ((is.string(val)) && (val.length > 0)) {
      queryObj[key] = val
    }
    else if ((is.array(val)) && (val.length > 0) && (!(is.object(val[0])))) {
      queryObj[key] = val.slice(0)
    }
    else if ((is.object(val)) || ((is.array(val)) && (val.length > 0) && ((is.object(val[0]))))) {
      queryObj[key] = JSON.stringify(val)
    }
  })
  return '?' + queryString.stringify(queryObj)
}

Querify.prototype.getQueryObject = function(str) {
  var parsedObj = queryString.parse(str, {arrayFormat: 'index'})
  var queryObj = {}
  this.keys.forEach((key) => {
    var val = parsedObj[key]
    if (is.string(val)) {
      if (is.json(val))
        queryObj[key] = JSON.parse(val)
      else if ((val === 'true') || (val === 'false'))
        queryObj[key] = (val === 'true')
      else
        queryObj[key] = escape(val)
    }
    else if (is.array(val)) {
      queryObj[key] = val.map((el) => escape(el))
    }
  })
  return queryObj
}
