const Stats = require('online-stats')
const Dygraphs = require('dygraphs')
const d3 = require('d3-array')
const hist2d = require('d3-hist2d').hist2d
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
}

function drawScalar (scalar, name) {
  const chartContainer = document.createElement('div')
  chartContainer.className = 'chart'
  chartContainer.innerHTML = `
    <h1>${(!isNaN(parseFloat(scalar)) && isFinite(scalar)) ? +scalar.toFixed(6) : scalar}</h1>
    <p>${name}</p>
  `
  document.querySelector('.charts').appendChild(chartContainer)
}

function drawObject (obj, name) {
  const chartContainer = document.createElement('div')
  chartContainer.className = 'chart'
  let cont = `<div class="summary"><h3>${name}</h3><table>`
  Object.keys(obj).forEach(key => {
    const val = obj[key]
    cont += `<tr><td><b>${key}<b></td>`
    if (Array.isArray(val) || (typeof val === 'string')) {
      cont += `<td>${val.toString().slice(0, 30)}</td></tr>`
    } else {
      cont += `<td>${(val % 1 === 0) ? val : val.toFixed(6)}</td></tr>`
    }
  })
  cont += `</table></div>`
  chartContainer.innerHTML = cont
  document.querySelector('.charts').appendChild(chartContainer)
}

function drawVector (vector, name) {
  createChart(
    name,
    vector.map((v, i) => [i, v]),
    ['Step', name]
  )
}

function drawVectors (vectors) {
  const keys = Object.keys(vectors)
  createChart(
    (keys.length > 5) ? 'Join' : keys.join(', '),
    vectors[keys[0]].map((_, i) => [i].concat(keys.map(k => vectors[k][i]))),
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

module.exports = function processResults (v) {
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
  const samples = {}
  // Maximum a posteriori with all variables
  let map = {}
  // MAP with only random variables
  let mapRandom = {}
  // Maximal MAP score
  let mapScore = Number.NEGATIVE_INFINITY
  // Collect random variables in rvs array to draw 2d plot later
  const rvs = []
  // Collect repeating samples
  // { var_name: true/false }
  const repeatingSamples = {}
  // Collect repeating arrays
  // { var_name: [values] }
  const repeatingArrays = {}

  // Iterate over initial samples
  v.samples.forEach((s, si) => {
    // Check sample score. Max score shows map estimate
    if (s.hasOwnProperty('score') && (s.score > mapScore)) {
      map = s.value
      mapScore = s.score
    }
    // Detect repeating samples
    Object.keys(s.value).forEach(k => {
      const sampleValue = s.value[k]
      if (!samples.hasOwnProperty(k)) {
        samples[k] = []
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
  if (Object.keys(mapRandom).length) {
    drawObject(mapRandom, 'MAP estimates')
  }

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
      drawObject(count, k + ' counts')
      // TODO: Draw pie chart?
    } else if (Array.isArray(samples[k][0])) {
      // --> Array samples
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
        drawScalar(samples[k][0], k)
      } else {
        // * Random scalar samples
        rvs.push(k)
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
          ['Sample', k],
          {
            stepPlot: true,
            fillGraph: true
          }
        )
        // ---- CDF
        const sMin = d3.min(samples[k])
        const sMax = d3.max(samples[k])
        if (sMin < sMax) {
          const sStep = (sMax - sMin) / 200
          const cdf = []
          for (let i = sMin; i <= sMax; i += sStep) {
            cdf.push([i, samples[k].filter(s => s < i).length / samples[k].length])
          }
          createChart(k + ' CDF', cdf, [k, 'p'])
        }
        // ---- Statistics
        const stats = Stats.Series([
          { stat: Stats.Mean(), name: 'Average' },
          { stat: Stats.Variance({ddof: 1}), name: 'Variance' },
          { stat: Stats.Std(), name: 'Stdev' },
          { stat: Stats.Median(), name: 'Median' },
          { stat: Stats.Min(), name: 'Min' },
          { stat: Stats.Max(), name: 'Max' }
        ])
        samples[k].forEach(s => stats(s))
        drawObject(stats.values, k + ' summary')

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
    drawVectors(repeatingArrays)
  }

  // Draw 2d plot
  if (rvs.length >= 2) {
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
            chartContainer.innerHTML = `<p>${rvs[r1]},${rvs[r2]}</p>`
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
