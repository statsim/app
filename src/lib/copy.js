// From https://ourcodeworld.com/articles/read/143/how-to-copy-text-to-clipboard-with-javascript-easily

module.exports = function copy (text) {
  var id = 'clipboard-textarea'
  var existsTextarea = document.getElementById(id)

  if (!existsTextarea) {
    var textarea = document.createElement('textarea')
    textarea.id = id
    textarea.style.position = 'fixed'
    textarea.style.top = 0
    textarea.style.left = 0
    textarea.style.width = '1px'
    textarea.style.height = '1px'
    textarea.style.padding = 0
    textarea.style.border = 'none'
    textarea.style.outline = 'none'
    textarea.style.boxShadow = 'none'
    textarea.style.background = 'transparent'
    document.querySelector('body').appendChild(textarea)
    existsTextarea = document.getElementById(id)
  }

  existsTextarea.value = text
  existsTextarea.select()

  try {
    var status = document.execCommand('copy')
    if (!status) {
      console.error('Copy.js: Cannot copy text')
    } else {
      console.log('Copy.js: Copied to the clipboard')
    }
  } catch (err) {
    console.log('Copy.js: Unable to copy!')
  }
}
