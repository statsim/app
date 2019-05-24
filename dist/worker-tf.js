console.log('Worker: Hi!')
console.log('Worker: Inviting TF to the chat..')

self.window = self

if (typeof OffscreenCanvas !== 'undefined') {
  console.log('Setting polyfills for TF to work in a worker')
  self.document = {
    createElement: () => {
      return new OffscreenCanvas(640, 480);
    }
  }
  self.window = {
            screen: {
                          width: 640,
                          height: 480
                      }
        }
  self.HTMLVideoElement = function() {}
  self.HTMLImageElement = function() {}
  self.HTMLCanvasElement = OffscreenCanvas;
}

importScripts('tf.min.js')

console.log('backend is %s', tf.getBackend());
// tf.setBackend('gpu')
// tf.setBackend('cpu')
// importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@0.10.0')
// importScripts('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.0.0/dist/tf.min.js')

if (tf) {
  console.log(`TF: Hello everyone! I'm ready to work!`)
} else {
  console.log(`x..x: No TF!`)
  throw new Error(`Can't load Tensorflow.js`)
}

var xs = tf.tensor1d([0, 1, 2, 3]);
console.log(xs.print())

/*
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
// importScripts = alert = fetch = navigator.serviceWorker = navigator.sendBeacon = XMLHttpRequest = WebSocket = EventSource = Fetch = FileReaderSync = FileReader = IndexedDB = indexedDB = Notifications = Worker = WorkerLocation = WorkerNavigator = replacer

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
*/
