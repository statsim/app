module.exports = function samplesToCSV (samples) {
  const keys = Object.keys(samples)

  // Generate CSV header
  const header = []
  keys.forEach(k => {
    const sample = samples[k][0]
    if (Array.isArray(sample)) {
      sample.forEach((_, i) => {
        header.push(k + '.' + i)
      })
    } else if (typeof sample === 'object') {
      Object.keys(sample).forEach(sk => {
        header.push(k + '.' + sk)
      })
    } else {
      header.push(k)
    }
  })

  // Init csv output
  let csv = header.join() + '\n'

  // Iterate over samples and update resulting csv variable
  samples[keys[0]].forEach((_, i) => {
    const row = []
    keys.forEach(k => {
      const sample = samples[k][i]
      if (Array.isArray(sample)) {
        sample.forEach(s => {
          row.push(s)
        })
      } else if (typeof sample === 'object') {
        Object.keys(sample).forEach(sk => {
          row.push(sample[sk])
        })
      } else if (typeof sample === 'string') {
        row.push('"' + sample + '"')
      } else {
        row.push(sample)
      }
    })
    csv += row.join() + '\n'
  })

  return csv
}
