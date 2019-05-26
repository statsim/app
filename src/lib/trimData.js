module.exports = function trimData (data) {
  let mcol = 0
  let mrow = 0
  let d = []
  data.forEach((r, ri) => {
    let emptyRow = true
    r.forEach((c, ci) => {
      if (!((c === '') || (c === null))) {
        emptyRow = false
        if (ci > mcol) {
          mcol = ci
        }
      }
    })
    if (!emptyRow) {
      mrow = ri
    }
  })

  for (let ri = 0; ri <= mrow; ri++) {
    if (!d[ri]) d[ri] = []
    for (let ci = 0; ci <= mcol; ci++) {
      d[ri][ci] = data[ri][ci]
    }
  }

  console.log('[Trim] Max row, Max col:', mrow, mcol)
  return d
}
