console.log('Worker: Hi!')
console.log('Worker: Inviting WebPPL to the chat..')

const INPUT_FNAME = 'input.smt2'
const STUB_MSG = 'Calling stub instead of signal()'

let ready = false
let res = ''

self.importScripts('assets/z3w.js')

function onRuntimeInitialized () {
  ready = true
  console.log('[Z3 worker] Ready!')
}

const solver = Z3({
  ENVIRONMENT: 'WORKER',
  onRuntimeInitialized: onRuntimeInitialized,
  print: function (message) {
    console.log('[Z3 worker] Print:', message)
    message = message.replace(STUB_MSG, '')
    res += message + '\n'
    if ((message.trim() === ')') || (message.includes('error'))) {
      console.log('[Z3 worker] Result:', res)
      postMessage({
        'data': res
      })
      res = ''
    }
  },
  printErr: function (message) {
    console.log('[Z3 worker] Error:', message)
    postMessage({
      'data': message
    })
  }
})

console.log(Z3)

onmessage = function (e) {
  console.log('[Z3 worker] received message from Vue. Calling Z3...')
  console.log(e)
  if (!ready) {
    console.error('[Z3 worker] Cannot run SMT solver yet...')
    return
  }

  const args = ['-smt2', INPUT_FNAME]
  console.log('[Z3 worker] Running SMT solver with', args)
  solver.FS.writeFile(INPUT_FNAME, e.data, { encoding: 'utf8' })
  solver.callMain(args)
}
