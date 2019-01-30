const version = 'v0.10.4f'
const assets = [
  '/',
  '/dist/density-plot.js',
  '/dist/bundle.js',
  '/dist/webppl.min.js',
  '/dist/worker.js',
  '/css/vue-material.css',
  '/css/handsontable.full.min.css',
  '/css/vue2-perfect-scrollbar.min.css',
  '/css/roboto.css',
  '/css/icons.css',
  '/css/vis-network.min.css',
  '/css/img/network/acceptDeleteIcon.png',
  '/css/img/network/addNodeIcon.png',
  '/css/img/network/backIcon.png',
  '/css/img/network/connectIcon.png',
  '/css/img/network/cross2.png',
  '/css/img/network/cross.png',
  '/css/img/network/deleteIcon.png',
  '/css/img/network/downArrow.png',
  '/css/img/network/editIcon.png',
  '/css/img/network/leftArrow.png',
  '/css/img/network/minus.png',
  '/css/img/network/plus.png',
  '/css/img/network/rightArrow.png',
  '/css/img/network/upArrow.png',
  '/css/img/network/zoomExtends.png',
  '/images/android-icon-192x192.png',
  '/images/favicon-16x16.png',
  '/images/favicon-32x32.png',
  '/images/favicon-96x96.png',
  '/images/favicon.ico',
  '/images/s.png',
  '/fonts/MaterialIcons-Regular.ttf',
  '/fonts/MaterialIcons-Regular.woff',
  '/fonts/MaterialIcons-Regular.woff2',
  '/fonts/Roboto-Bold.ttf',
  '/fonts/Roboto-Bold.woff',
  '/fonts/Roboto-Bold.woff2',
  '/fonts/Roboto-Light.ttf',
  '/fonts/Roboto-Light.woff',
  '/fonts/Roboto-Light.woff2',
  '/fonts/Roboto-Medium.ttf',
  '/fonts/Roboto-Medium.woff',
  '/fonts/Roboto-Medium.woff2',
  '/fonts/Roboto-Regular.ttf',
  '/fonts/Roboto-Regular.woff',
  '/fonts/Roboto-Regular.woff2'
]

console.log('Service worker: version', version)

self.addEventListener('install', function (event) {
  console.log('Service worker: Installation started')
  event.waitUntil(
    caches
      .open(version)
      .then(function (cache) {
        return cache.addAll(assets)
      })
      .then(function () {
        console.log(`Service worker: Installation completed. Cached ${assets.length} assets`)
      })
  )
})

self.addEventListener('activate', function (event) {
  console.log('Service worker: Activation started')
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        console.log('Service worker: Caches', keys)
        return Promise.all(
          keys
            .filter(function (key) {
              return !key.startsWith(version)
            })
            .map(function (key) {
              console.log('Service worker: Remove cache', key)
              return caches.delete(key)
            })
        )
      })
      .then(function () {
        console.log('Service worker: Activation completed')
      })
  )
})

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') {
    console.log('Service worker: fetch event ignored', event.request.method, event.request.url)
    return
  }
  event.respondWith(
    caches
      .match(event.request)
      .then(function (cached) {
        const networked = fetch(event.request)
          .then(fetchedFromNetwork, unableToResolve)
          .catch(unableToResolve)

        console.log('Service worker: fetch result ', cached ? '(cached)' : '(network)', event.request.url)
        return cached || networked

        function fetchedFromNetwork (response) {
          const cacheCopy = response.clone()
          // console.log('Service worker: fetch response from network', event.request.url)
          caches
            .open(version)
            .then(function add (cache) {
              cache.put(event.request, cacheCopy)
            })
            .then(function () {
              // console.log('Service worker: fetch response stored in cache', event.request.url)
            })
          return response
        }

        function unableToResolve () {
          console.log('Service worker: fetch request failed in both cache and network')
          return new Response('<h1>StatSim: Service Unavailable</h1><p>The page is not cached. Check your network connection.</p>', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/html'
            })
          })
        }
      }) // *caches.match.then
  ) // *respondwith
})
