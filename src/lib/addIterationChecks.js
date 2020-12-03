const spacesToUnderscores = require('./spacesToUnderscores')

/**
 * Add checks:
 * If variable is defined, keep it, else - use underscored
 * @param {string} string - code block to process
 * @param {string[]} names - block names
 */
function addIterationChecks (string, blocks) {
  let newString = spacesToUnderscores(
    string,
    blocks
      .filter(block => block.name && block.name.length)
      .map(block => block.name)
  )
  blocks
    .filter(block => [1, 3].includes(block.typeCode))
    .map(block => block.name)
    .forEach(name => {
      const n = name.replace(/\s/g, '__')
      const r = new RegExp(`\\b${n}\\b`, 'g')
      newString = newString.replace(r, `(typeof ${n} !== 'undefined' ? ${n} : _${n})`)
    })
  return newString.replace(/__/g, ' ')
}

module.exports = addIterationChecks
