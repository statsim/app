const version = 'v0.11.0a'
const assets = [
  '/app/',
  '/app/dist/density-plot.js',
  '/app/dist/bundle.js',
  '/app/dist/webppl.min.js',
  '/app/dist/worker.js',
  '/app/css/vue-material.css',
  '/app/css/handsontable.full.min.css',
  '/app/css/vue2-perfect-scrollbar.min.css',
  '/app/css/roboto.css',
  '/app/css/icons.css',
  '/app/css/vis-network.min.css',
  '/app/css/img/network/acceptDeleteIcon.png',
  '/app/css/img/network/addNodeIcon.png',
  '/app/css/img/network/backIcon.png',
  '/app/css/img/network/connectIcon.png',
  '/app/css/img/network/cross2.png',
  '/app/css/img/network/cross.png',
  '/app/css/img/network/deleteIcon.png',
  '/app/css/img/network/downArrow.png',
  '/app/css/img/network/editIcon.png',
  '/app/css/img/network/leftArrow.png',
  '/app/css/img/network/minus.png',
  '/app/css/img/network/plus.png',
  '/app/css/img/network/rightArrow.png',
  '/app/css/img/network/upArrow.png',
  '/app/css/img/network/zoomExtends.png',
  '/app/images/android-icon-192x192.png',
  '/app/images/favicon-16x16.png',
  '/app/images/favicon-32x32.png',
  '/app/images/favicon-96x96.png',
  '/app/images/favicon.ico',
  '/app/images/s.png',
  '/app/fonts/MaterialIcons-Regular.ttf',
  '/app/fonts/MaterialIcons-Regular.woff',
  '/app/fonts/MaterialIcons-Regular.woff2',
  '/app/fonts/Roboto-Bold.ttf',
  '/app/fonts/Roboto-Bold.woff',
  '/app/fonts/Roboto-Bold.woff2',
  '/app/fonts/Roboto-Light.ttf',
  '/app/fonts/Roboto-Light.woff',
  '/app/fonts/Roboto-Light.woff2',
  '/app/fonts/Roboto-Medium.ttf',
  '/app/fonts/Roboto-Medium.woff',
  '/app/fonts/Roboto-Medium.woff2',
  '/app/fonts/Roboto-Regular.ttf',
  '/app/fonts/Roboto-Regular.woff',
  '/app/fonts/Roboto-Regular.woff2'
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
