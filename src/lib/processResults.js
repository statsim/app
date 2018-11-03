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
    colors: ['#3f51b5', '#ce3657'],
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
  headerContainer.className = 'result-header'
  let h2 = document.createElement('h2')
  if (value === undefined) {
    // No value in the header
    h2.innerText = name
    headerContainer.innerHTML = ''
    headerContainer.appendChild(h2)
  } else {
    // Value exist
    h2.innerText = name + ': '
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
  h3.innerText = name

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

function drawVector (vector, name) {
  createChart(
    name,
    vector.map((v, i) => [i + 1, v]),
    ['Step', name]
  )
}

function drawVectors (vectors) {
  const keys = Object.keys(vectors)
  createChart(
    (keys.length > 5) ? 'Join' : keys.join(', '),
    vectors[keys[0]].map((_, i) => [i + 1].concat(keys.map(k => vectors[k][i]))),
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

module.exports = function processResults (v, blocks) {
  console.log('Processor, PhD: Z-z-z..')
  console.log('Processor, PhD: Uh?')

  // Deterministic simulation
  if (!v.hasOwnProperty('samples')) {
    console.log(`Processor, PhD: That's a determistic BS, converting it to pseudo-random object!`)
    v = {samples: [{score: 0, value: v}]}
    console.log(`Processor, PhD: Looks like random now,`, v)
  }

  console.log('Processor, PhD: Random samples. Good! Busy now!', v)

  // Collect samples in a useful object:
  // { variable_name: [1,2,...] }
  let samples = {}
  // Collect units
  let units = {}
  // Maximum a posteriori with all variables
  let map = {}
  // MAP with only random variables
  let mapRandom = {}
  // Maximal MAP score
  let mapScore = Number.NEGATIVE_INFINITY
  // Collect random variables in rvs array to draw 2d plot later
  let rvs = []
  // Collect repeating samples
  // { var_name: true/false }
  let repeatingSamples = {}
  // Collect repeating arrays
  // { var_name: [values] }
  let repeatingArrays = {}

  // Iterate over initial samples
  v.samples.forEach((s, si) => {
    // Check sample score. Max score shows map estimate
    if (s.hasOwnProperty('score') && (s.score > mapScore)) {
      map = s.value
      mapScore = s.score
    }
    // Detect repeating samples
    // Collect samples in a proper object
    // Collect units
    Object.keys(s.value).forEach(k => {
      const sampleValue = s.value[k]
      if (!samples.hasOwnProperty(k)) {
        samples[k] = []
        units[k] = blocks.find(b => b.name === k).units
        repeatingSamples[k] = true
      }
      if ((samples[k].length) && (JSON.stringify(sampleValue) !== JSON.stringify(samples[k][0]))) {
        repeatingSamples[k] = false
      }
      samples[k].push(s.value[k])
    })
  })

  // Filter MAP object to contain only random variables
  Object.keys(map).forEach(k => {
    if (!repeatingSamples[k]) {
      mapRandom[k] = map[k]
    }
  })

  // Show MAP estimates if mapRandom has elements
  // Temporary hide MAP block
  /*
  if (Object.keys(mapRandom).length) {
    drawObject(mapRandom, 'MAP estimates')
  }
  */

  // Iterate over rearranged samples
  Object.keys(samples).forEach(k => {
    if ((typeof samples[k][0] === 'boolean') || (typeof samples[k][0] === 'string')) {
      // --> Boolean and String samples (count samples)
      let count = {}
      samples[k].forEach(v => {
        if (!count.hasOwnProperty(v)) {
          count[v] = 0
        }
        count[v] += 1
      })
      drawHeader(k)
      drawObject(count, k + ' counts')
      // TODO: Draw pie chart?
    } else if (Array.isArray(samples[k][0])) {
      // --> Array samples
      drawHeader(k)
      if (repeatingSamples[k]) {
        // * All sampled arrays are same
        repeatingArrays[k] = samples[k][0]
        drawVector(samples[k][0], k)
        const stats = Stats.Series([
          { stat: Stats.Mean(), name: 'Average' },
          { stat: Stats.Variance({ddof: 1}), name: 'Variance' },
          { stat: Stats.Std(), name: 'Stdev' },
          { stat: Stats.Median(), name: 'Median' },
          { stat: Stats.Min(), name: 'Min' },
          { stat: Stats.Max(), name: 'Max' }
        ])
        samples[k][0].forEach(s => stats(s))
        drawObject(stats.values, k + ' summary')
      } else {
        // * Random arrays samples
        const data = []
        const labels = ['Step']
        samples[k].forEach((s, si) => {
          labels.push(k + ` (v${si})`)
          s.forEach((sv, i) => {
            if (!data[i]) data[i] = [i]
            data[i].push(sv)
          })
        })
        createChart(`${k} ${samples[k].length} samples`, data, labels)
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
        drawHeader(
          k,
          samples[k][0],
          (samples[k][0].toString().split('.')[1] > 6) ? '*Rounded' : '',
          units[k]
        )
        // drawScalar(samples[k][0], k)
      } else {
        // * Random scalar samples
        rvs.push(k)

        // Show header and MAP estimate
        drawHeader(
          k,
          map[k],
          (map[k] !== undefined) ? 'MAP estimate' : '',
          units[k]
        )
        // Prepare needed transforms
        const sorted = samples[k].slice().sort((a, b) => a - b)
        const n = sorted.length

        // Draw trace
        createChart(k + ' trace', samples[k].map((s, si) => [si, s]), ['Sample', k])

        // Draw auto-covariogram
        const autocov = Stats.AutoCov(50)
        createChart(k + ' autocovariogram', autocov(samples[k]).map((c, ci) => [ci, c]), ['Lag', 'Autocovariance'])

        // Draw histogram
        const unique = Array.from(new Set(samples[k])).length
        const t = (unique <= 30) ? unique : 30
        const hist = d3.histogram().thresholds(t)
        const h = hist(samples[k])
        createChart(
          k + ' histogram',
          h.map(v => [v.x0, v.length / samples[k].length]),
          [k, 'p'],
          {
            stepPlot: true,
            fillGraph: true
          }
        )

        // ---- PDF (KDE smoothing)
        const pdf = pdfast.create(samples[k], {size: 30, min: sorted[0], max: sorted[sorted.length - 1]})
        console.log('PDF:', pdf)
        createChart(
          k + ' PDF (smooth)',
          pdf.map(v => [v.x, v.y]),
          [k, 'f'],
          {
            rollPeriod: 2,
            fillGraph: true
          }
        )

        // ---- CDF (updated)
        const step = (sorted[sorted.length - 1] - sorted[0]) / 200
        if (step > 0) {
          let cdf = []
          let counter = 0
          let nextPoint = sorted[0] + step
          let cdfBin = 0
          for (let i = 0; i < n; i++) {
            counter += 1
            if (sorted[i] >= nextPoint) {
              while (nextPoint < sorted[i]) {
                cdf[cdfBin] = [nextPoint, counter / n]
                cdfBin += 1
                nextPoint += step
              }
            }
          }
          createChart(k + ' CDF', cdf, [k, 'F'])
        }

        // ---- Quantiles
        const quantile = (arr, p) => {
          const _h = (arr.length - 1) * p + 1
          const h = Math.floor(_h)
          const v = +arr[h - 1]
          const e = _h - h
          return e ? v + e * (arr[h] - v) : v
          // h < 1 ? arr[0] : h >= arr.length ? arr[arr.length - 1] : arr[h - 1] + (_h - h) * (arr[h] - arr[h - 1])
        }
        const quantiles = {
          '2.5%': quantile(sorted, 0.025),
          '25%': quantile(sorted, 0.25),
          '50%': quantile(sorted, 0.5),
          '75%': quantile(sorted, 0.75),
          '97.5%': quantile(sorted, 0.975)
        }

        // ---- Statistics
        const stats = Stats.Series([
          { stat: Stats.Mean(), name: 'Mean' },
          // { stat: Stats.Variance({ddof: 1}), name: 'Variance' },
          { stat: Stats.Std(), name: 'Std' },
          { stat: Stats.Min(), name: 'Min' },
          { stat: Stats.Max(), name: 'Max' }
        ])
        samples[k].forEach(s => stats(s))

        // Prepare summary
        const summary = Object.assign({}, quantiles, stats.values)
        // Remove number of observations
        delete summary.n
        // Draw summary block
        drawObject(summary, k + ' summary', units[k])

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
        const samples2d = samples[rvs[r1]].map((v, i) => [v, samples[rvs[r2]][i]])
        const r1min = d3.min(samples[rvs[r1]])
        const r1max = d3.max(samples[rvs[r1]])
        const r2min = d3.min(samples[rvs[r2]])
        const r2max = d3.max(samples[rvs[r2]])
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
  console.log('Processor, PhD: Finished! Check the DOM!')
}
