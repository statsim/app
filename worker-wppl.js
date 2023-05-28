console.log('Worker: Hi!')
console.log('Worker: Inviting WebPPL to the chat..')

importScripts('/assets/webppl.min.js')

if (webppl) {
  console.log(`WebPPL: Hello everyone! I'm ready to work!`)
} else {
  console.log(`Worker: WTF! Where's WebPPL? Error?`)
  throw new Error(`Can't load WebPPL`)
}

const hm = `
*****************************************************************************
* Hey! You're smart, but it's a free project. Please don't hack it! Thanks! *
*****************************************************************************
`

function replacer () {
  console.log(hm)
  throw new Error('Invalid function call')
}

// Limit worker functionality to prevent attacks
importScripts = alert = fetch = navigator.serviceWorker = navigator.sendBeacon = XMLHttpRequest = WebSocket = EventSource = Fetch = FileReaderSync = FileReader = IndexedDB = indexedDB = Notifications = Worker = WorkerLocation = WorkerNavigator = replacer

onmessage = function (e) {
  console.log(`Worker: received message from Vue. Calling WebPPL..`)
  webppl.run(e.data, function (s, v) {
    console.log(`WebPPL: Done!`)
    console.log(`Worker: Sending results to Vue..`)
    if (v.samples && v.samples.length) {
      postMessage({samples: v.samples})
    } else {
      postMessage(v)
    }
  })
}
