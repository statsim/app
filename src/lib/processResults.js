const Stats = require('online-stats')
const Dygraphs = require('dygraphs')
const d3 = require('d3-array')
const hist2d = require('d3-hist2d').hist2d
const pdfast = require('pdfast')
const plot2d = window['densityPlot'] // ESM WTF!!!

function createChart (chartTitle, chartData, chartLabels, chartOptions) {
  const chartContainer = document.createElement('div')
  chartContainer.className = 'chart' + ((chartLabels.length > 5) ? ' chart-heavy' : '')
  document.querySelector('.charts').appendChild(chartContainer)
  let options = {
    title: chartTitle,
    labels: chartLabels,
    colors: ['#3f51b5', '#ce3657', '#7CCD40', '#F3C50F'],
    strokeWidth: 1,
    strokeBorderWidth: 0
  }
  if (chartLabels.length <= 1100) {
    options.highlightCircleSize = 2
    options.highlightSeriesOpts = {
      strokeBorderWidth: 1,
      highlightCircleSize: 3
    }
  } else {
    options.highlightCircleSize = 0
    options.showLabelsOnHighlight = false
  }
  Object.assign(options, chartOptions)
  const d = new Dygraphs(
    chartContainer,
    chartData,
    options
  )
  console.log(`Dygraph: I'm here`, d)
}

function drawHeader (name, value, description, units) {
  const headerContainer = document.createElement('div')
  const newName = name.replace(/__/g, ' ')
  headerContainer.className = 'result-header'
  let h2 = document.createElement('h2')
  if (value === undefined) {
    // No value in the header
    h2.innerText = newName
    headerContainer.innerHTML = ''
    headerContainer.appendChild(h2)
  } else {
    // Value exist
    h2.innerText = newName + ': '
    let vSpan = document.createElement('span')
    vSpan.className = 'result-value'
    vSpan.innerText = (!isNaN(parseFloat(value)) && isFinite(value)) ? +value.toFixed(6) : value
    h2.appendChild(vSpan)
    if (units && units.length) {
      let uSpan = document.createElement('span')
      uSpan.className = 'result-units'
      uSpan.innerText = ' ' + units
      h2.appendChild(uSpan)
    }
  }
  headerContainer.appendChild(h2)
  if (description !== undefined) {
    let dSpan = document.createElement('span')
    dSpan.className = 'result-description'
    dSpan.innerText = description
    headerContainer.appendChild(dSpan)
  }
  document.querySelector('.charts').appendChild(headerContainer)
}

/*
function drawScalar (scalar, name) {
  const chartContainer = document.createElement('div')
  chartContainer.className = 'chart'
  chartContainer.innerHTML = `
    <h1>${(!isNaN(parseFloat(scalar)) && isFinite(scalar)) ? +scalar.toFixed(6) : scalar}</h1>
    <p>${name}</p>
  `
  document.querySelector('.charts').appendChild(chartContainer)
}
*/

function drawObject (obj, name, units) {
  let chartContainer = document.createElement('div')
  chartContainer.className = 'chart'

  let summaryDiv = document.createElement('div')
  summaryDiv.className = 'summary'

  let h3 = document.createElement('h3')
  h3.innerText = name.replace(/__/g, ' ')

  summaryDiv.appendChild(h3)

  let table = document.createElement('table')

  Object.keys(obj).forEach(key => {
    const val = obj[key]
    let b = document.createElement('b')
    b.innerText = key
    let td1 = document.createElement('td')
    td1.appendChild(b)
    let tr = document.createElement('tr')
    tr.appendChild(td1)
    let td2 = document.createElement('td')
    if (Array.isArray(val) || (typeof val === 'string')) {
      td2.innerText = val.toString().slice(0, 30)
    } else {
      td2.innerText = (val % 1 === 0) ? val : val.toFixed(6)
    }
    if (units && units.length) {
      td2.innerText += ' ' + units
    }
    tr.appendChild(td2)
    table.appendChild(tr)
  })

  summaryDiv.appendChild(table)
  chartContainer.appendChild(summaryDiv)
  document.querySelector('.charts').appendChild(chartContainer)
}

function drawVector (vector, name, timeStart) {
  createChart(
    name,
    vector.map((v, i) => [i + ((timeStart !== undefined) ? timeStart : 1), v]),
    ['Step', name]
  )
}

function drawVectors (vectors, timeStart) {
  const keys = Object.keys(vectors)
  createChart(
    (keys.length > 5) ? 'Join' : keys.join(', '),
    vectors[keys[0]].map((_, i) => [i + ((timeStart !== undefined) ? timeStart : 1)].concat(keys.map(k => vectors[k][i]))),
    ['Step'].concat(keys)
  )
}

function topN (n, countObj) {
  let top = {}
  for (let k in countObj) {
    const keys = Object.keys(top)
    if (keys.length < n) {
      // Add values to top until N
      top[k] = countObj[k]
    } else {
      // Find min
      let minValue = Infinity
      let minKey
      keys.forEach(k => {
        if (top[k] < minValue) {
          minKey = k
          minValue = top[k]
        }
      })
      // If more than min, add, than delete min
      if (countObj[k] > minValue) {
        top[k] = countObj[k]
        delete top[minKey]
      }
    }
  }
  return top
}

module.exports = function processResults (chains, blocks, modelParams) {
  // Now v is an array of results from one or multiple workers
  console.log('Processor, PhD: Z-z-z..')
  console.log('Processor, PhD: Uh?')
  console.log('Processor, PhD: Why you send me this?', chains)

  // Deterministic simulation
  if ((chains.length === 1) && !chains[0].hasOwnProperty('samples')) {
    console.log(`Processor, PhD: That's a determistic BS, converting it to pseudo-random result!`)
    chains[0] = {samples: [{score: 0, value: chains[0]}]}
    console.log(`Processor, PhD: Looks like a random output now!`)
  }

  console.log('Processor, PhD: Busy now!')

  // Collect samples in a useful object:
  // { variable_name: [[1,2,...], [2,1,3...]]} - multiple chains case
  let samples = {}
  // Collect units
  let units = {}
  // Maximum a posteriori with all variables
  // [{variable_1: value, variable_2: value}, {}]
  let map = []

  // Collect random variables in rvs array to draw 2d plot later
  let rvs = []
  // Collect repeating samples
  // { var_name: true/false }
  let repeatingSamples = {}
  // Collect repeating arrays
  // { var_name: [values] }
  let repeatingArrays = {}

  chains.forEach((chain, ci) => {
  // Iterate over initial samples
  // Maximal MAP score
    let mapScore = Number.NEGATIVE_INFINITY
    chain.samples.forEach((s, si) => {
      // Check sample score. Max score shows map estimate
      if (s.hasOwnProperty('score') && (s.score > mapScore)) {
        map[ci] = s.value
        mapScore = s.score
      }
      // Detect repeating samples
      // Collect samples in a proper object
      // Collect units
      Object.keys(s.value).forEach(k => {
        const sampleValue = s.value[k]
        // Check if we don't have such variable in samples object
        if (!samples.hasOwnProperty(k)) {
          samples[k] = []
          const thatBlock = blocks.find(b => b.name === k.replace('_hist', ''))
          units[k] = (thatBlock !== undefined) ? thatBlock.units : ''
          repeatingSamples[k] = true
        }
        // Check if it's a first sample in the chain
        if (si === 0) {
          samples[k][ci] = []
        }
        // Push sample
        samples[k][ci].push(sampleValue)
        // Check if all samples are same
        if (JSON.stringify(sampleValue) !== JSON.stringify(samples[k][0][0])) {
          repeatingSamples[k] = false
        }
      })
    }) // *samples
  }) // *chains

  console.log('Processor, PhD: Updated samples and MAP are ready')
  console.log('Samples: ', samples)
  console.log('MAP: ', map)

  let allSamples = {}
  // Iterate over rearranged samples
  Object.keys(samples).forEach(k => {
    // Concat all samples
    allSamples[k] = []

    samples[k].forEach(samplesArr => {
      allSamples[k] = allSamples[k].concat(samplesArr)
    })
    console.log('All samples:', allSamples)

    // Total min and max
    const min = d3.min(allSamples[k])
    const max = d3.max(allSamples[k])

    if ((typeof samples[k][0][0] === 'boolean') || (typeof samples[k][0][0] === 'string')) {
      // --> Boolean and String samples (count samples)
      drawHeader(k)
      samples[k].forEach((samplesArr, ci) => {
        let count = {}
        samplesArr.forEach(v => {
          if (!count.hasOwnProperty(v)) {
            count[v] = 0
          }
          count[v] += 1
        })
        drawObject(count, k + ' count' + ((chains.length > 1) ? ` (ch. ${ci})` : ''))
      })
      // TODO: Draw pie chart?
    } else if (Array.isArray(samples[k][0][0])) {
      // --> Array samples
      drawHeader(k)
      if (repeatingSamples[k]) {
        // * All sampled arrays are same
        repeatingArrays[k] = samples[k][0][0]
        drawVector(
          samples[k][0][0], // values
          k, // name
          ((k.indexOf('_hist') >= 0) && (modelParams.start !== undefined)) ? modelParams.start : 1
        )
        const stats = Stats.Series([
          { stat: Stats.Mean(), name: 'Average' },
          { stat: Stats.Variance({ddof: 1}), name: 'Variance' },
          { stat: Stats.Std(), name: 'Stdev' },
          { stat: Stats.Median(), name: 'Median' },
          { stat: Stats.Min(), name: 'Min' },
          { stat: Stats.Max(), name: 'Max' }
        ])
        samples[k][0][0].forEach(s => stats(s))
        drawObject(stats.values, k + ' summary')
      } else {
        // * Random arrays samples
        const data = []
        const labels = ['Step']
        allSamples[k].forEach((s, si) => {
          labels.push(k + ` (s. ${si})`)
          s.forEach((sv, i) => {
            if (!data[i]) data[i] = [i + (((k.indexOf('_hist') >= 0) && (modelParams.start !== undefined)) ? modelParams.start : 1)]
            data[i].push(sv)
          })
        })
        createChart(`${k} ${allSamples[k].length} samples`, data, labels)
        createChart(
          k + ' Average',
          data.map(
            d => [d[0], [d3.min(d.slice(1)), d3.mean(d.slice(1)), d3.max(d.slice(1))]]
          ),
          ['Step', k],
          {
            customBars: true
          }
        )
      } // <-- Array samples
    } else {
      // --> Scalar samples
      if (repeatingSamples[k]) {
        // * Repeating scalar samples (not random)
        console.log('Repeating scalar: ', samples[k][0][0])
        drawHeader(
          k,
          samples[k][0][0],
          (samples[k][0][0].toString().split('.')[1] > 6) ? '*Rounded' : '',
          units[k]
        )
        // drawScalar(samples[k][0], k)
      } else {
        // * Random scalar samples
        rvs.push(k)

        // Show header and MAP estimate
        let averagedMAP
        if (map.length && (map[0][k] !== undefined)) {
          averagedMAP = map.reduce((acc, m) => acc + m[k], 0) / chains.length
        }

        drawHeader(
          k,
          averagedMAP,
          (averagedMAP !== undefined)
            ? 'MAP estimate' + ((chains.length > 1) ? ` (averaged: ${map.map(m => m[k].toFixed(6)).toString()})` : '')
            : '',
          units[k]
        )
        // Prepare needed transforms
        let sorted = []
        // Trace
        let trace = []
        let traceLabels = ['Sample']
        // Autocov
        let cov = []
        let covLabels = ['Lag']
        // Histogram
        let hist = []
        let histLabels = [k]
        // PDF
        let pdf = []
        let pdfLabels = [k]
        // CDF
        let cdf = []
        let cdfLabels = [k]
        const step = (max - min) / 200 // CDF step

        // Iterate over all chain samples
        samples[k].forEach((samplesArr, ci) => {
          // Sort each chain samples
          sorted[ci] = samplesArr.slice().sort((a, b) => a - b)
          // Prepare trace labels
          traceLabels.push(k + `(ch. ${ci + 1})`)

          // Calculate autocov
          let autocov = Stats.AutoCov(50)
          samplesArr.forEach((sample, si) => {
            autocov(sample)
            if (!trace[si]) trace[si] = [si]
            trace[si].push(sample)
          })
          // Dychart wants to have each point as [index, value1, value2 etc]
          autocov().forEach((c, covi) => {
            if (!cov[covi]) cov[covi] = [covi]
            cov[covi].push(c)
          })
          covLabels.push(`Autocov (ch. ${ci})`)

          // Prepare histogram
          const unique = Array.from(new Set(samplesArr)).length
          const t = (unique <= 40) ? unique : 40
          const histogram = d3.histogram().domain([min, max]).thresholds(t)
          const h = histogram(samplesArr)
          h.forEach((hv, hvi) => {
            if (!hist[hvi]) hist[hvi] = [hv.x0]
            hist[hvi].push(hv.length / samplesArr.length)
          })
          histLabels.push(`p (ch. ${ci})`)

          // PDF
          const p = pdfast.create(samplesArr, {size: 30, min: min, max: max})
          p.forEach((pv, pvi) => {
            if (!pdf[pvi]) pdf[pvi] = [pv.x]
            pdf[pvi].push(pv.y)
          })
          pdfLabels.push(`f (ch. ${ci})`)

          // CDF
          if (step > 0) {
            let nextPoint = min + step
            let cdfBin = 0
            for (let i = 0; i < sorted[ci].length; i++) {
              if (sorted[ci][i] >= nextPoint) {
                while (nextPoint < sorted[ci][i]) {
                  if (!cdf[cdfBin]) cdf[cdfBin] = [nextPoint]
                  cdf[cdfBin].push(i / sorted[ci].length)
                  cdfBin += 1
                  nextPoint += step
                }
              }
            }
            cdfLabels.push(`F (ch. ${ci})`)
          }
        })

        // Draw trace
        createChart(k + ' trace', trace, traceLabels)

        // Draw auto-covariogram
        createChart(k + ' autocovariogram', cov, covLabels)

        // Draw histogram
        createChart(k + ' histogram', hist, histLabels, {
          stepPlot: true,
          fillGraph: true
        })

        // Draw PDF (KDE smoothing)
        createChart(k + ' PDF (smooth)', pdf, pdfLabels, {
          rollPeriod: 2,
          fillGraph: true
        })

        // Draw CDF (updated)
        createChart(k + ' CDF', cdf, cdfLabels)

        // ---- Quantiles
        const allSorted = allSamples[k].slice().sort((a, b) => a - b)
        const quantile = (arr, p) => {
          const _h = (arr.length - 1) * p + 1
          const h = Math.floor(_h)
          const v = +arr[h - 1]
          const e = _h - h
          return e ? v + e * (arr[h] - v) : v
        }
        const quantiles = {
          '2.5%': quantile(allSorted, 0.025),
          '25%': quantile(allSorted, 0.25),
          '50%': quantile(allSorted, 0.5),
          '75%': quantile(allSorted, 0.75),
          '97.5%': quantile(allSorted, 0.975)
        }

        // ---- Statistics
        const stats = Stats.Series([
          { stat: Stats.Mean(), name: 'Mean' },
          // { stat: Stats.Variance({ddof: 1}), name: 'Variance' },
          { stat: Stats.Std(), name: 'Std' },
          { stat: Stats.Min(), name: 'Min' },
          { stat: Stats.Max(), name: 'Max' }
        ])
        allSamples[k].forEach(s => stats(s))

        // Prepare summary
        const summary = Object.assign({}, quantiles, stats.values)
        // Remove number of observations
        delete summary.n
        // Draw summary block
        drawObject(summary, `${k} summary`, units[k])

        // ---- Top 5 values
        const counter = Stats.Count({countArrays: true})
        counter(samples[k])
        let showTop = false
        const top = topN(5, counter.values)
        for (let t in top) {
          if (top[t] !== 1) {
            showTop = true
          }
        }
        if (showTop) {
          drawObject(topN(5, top), `Top ${Object.keys(top).length <= 5 ? Object.keys(top).length : 5} ${k} values`)
        }
      } // -- *draw random variable
    } // *scalars samples
  }) // *iterate over all sample keys (k)

  // Draw repeating arrays on one plot
  if (Object.keys(repeatingArrays).length > 1) {
    drawHeader('All values')
    drawVectors(repeatingArrays)
  }

  // Draw 2d plot
  if (rvs.length >= 2) {
    drawHeader('2D plot')
    document.querySelector('.charts-2d').innerHTML = ''
    for (let r1 = 0; r1 < rvs.length - 1; r1++) {
      for (let r2 = r1 + 1; r2 < rvs.length; r2++) {
        const samples2d = allSamples[rvs[r1]].map((v, i) => [v, allSamples[rvs[r2]][i]])
        const r1min = d3.min(allSamples[rvs[r1]])
        const r1max = d3.max(allSamples[rvs[r1]])
        const r2min = d3.min(allSamples[rvs[r2]])
        const r2max = d3.max(allSamples[rvs[r2]])
        hist2d().bins(100).domain([[r1min, r1max], [r2min, r2max]])(
          samples2d,
          h => {
            const plotData = []
            for (let i = 0; i < 100; i++) {
              if (!Array.isArray(plotData[i])) {
                plotData[i] = []
              }
              for (let j = 0; j < 100; j++) {
                plotData[i][j] = 0
              }
            }

            h.forEach(bin => { plotData[bin.x][bin.y] = bin.length })
            const chartContainer = document.createElement('div')
            chartContainer.className = 'chart-2d'
            let p = document.createElement('p')
            p.innerText = rvs[r1] + ',' + rvs[r2]
            chartContainer.appendChild(p)
            const chartCanvasContainer = document.createElement('div')
            chartContainer.appendChild(chartCanvasContainer)
            document.querySelector('.charts-2d').appendChild(chartContainer)
            plot2d(plotData, {
              simple: true,
              target: chartCanvasContainer,
              noXAxes: true,
              noYAxes: true,
              noLegend: true,
              width: 300,
              height: 300,
              color: 'Blues'
            })
          }
        )
      }// *for
    }// *for
  }
  console.log('Processor, PhD: Finished! Returning all samples object')

  return allSamples
} // *processResults
