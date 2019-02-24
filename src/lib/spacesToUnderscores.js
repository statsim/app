/**
 * Replaces all spaces in string for all names
 * @param {string} string - code block to process
 * @param {string[]} names - block names
 */
function spacesToUnderscores (string, names) {
  let newString = string
  names
    // Sort names to have longest first to prevent (A B + A B C -> A__B + A__B C)
    .sort((a, b) => b.length - a.length)
    // Iterate over all names and change spaces to __
    .forEach(name => {
      if (name.length && name.includes(' ')) {
        const newName = name.replace(/\s/g, '__')
        newString = newString
          // A B -> A__B
          .replace(new RegExp(`\\b${name}\\b`, 'g'), newName)
          // _A B -> _A__B
          .replace(new RegExp(`_${name}`, 'g'), `_${newName}`)
          // A B_ -> A__B_
          .replace(new RegExp(`${name}_`, 'g'), `${newName}_`)
      }
    })
  return newString
}

module.exports = spacesToUnderscores
