const Qty = require('js-quantities')

// Guess units of expression inside the `str`
function guessUnits (str, blocks) {
  // Recursively find units of expressions inside brackets `(` and `)`
  str = str.replace(
    /\((.*?)\)/g, // select everythin inside brackets
    s => guessUnits(s.substring(1, s.length - 1), blocks) // remove brackets, call guessUnits()
  )

  // Break the expression on parts by + and - signs, trim
  let arr = str.split(/[+-]/).map(s => s.trim())
  console.log(arr)

  // Iterate over all strings in the array
  arr = arr.map(s => {
    s = s.replace(
      /(\w+)/g,
      word => {
        console.log({word})
        const bl = blocks.find(b => b.name === word)
        if (bl) {
          console.log(bl.units)
          return bl.units
        } else {
          return word
        }
      }
    )
    console.log({s})
    const q = Qty.parse(s)
    if (q) {
      return q.toString().split(' ').splice(1).join('')
    } else {
      return s
    }
  })
  console.log(arr)

  // Return first non empty unit expression
  return arr.filter(s => s.length > 0)[0]
}

module.exports = guessUnits
