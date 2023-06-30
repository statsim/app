const version = 'v0.13.3e'
const assets = [
  '/app/',
  '/app/dist/bundle.js',
  'https://cdn.jsdelivr.net/npm/@statsim/app@latest/dist/bundle.js',
  'https://unpkg.com/@statsim/app@latest/dist/bundle.js',
  '/app/worker-wppl.js',
  '/app/worker-z3.js',
  '/app/assets/density-plot.js',
  '/app/assets/webppl.min.js',
  '/app/assets/z3w.js',
  '/app/assets/z3w.wasm',
  '/app/css/handsontable.full.min.css',
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

const log = (...args) => console.log('[Service worker]', ...args)
log('Version', version)

self.addEventListener('install', function (event) {
  log('Installation started')
  event.waitUntil(
    caches
      .open(version)
      .then(function (cache) {
        return cache.addAll(assets)
      })
      .then(function () {
        log(`Installation completed. Cached ${assets.length} assets`)
      })
  )
})

self.addEventListener('activate', function (event) {
  log('Activation started')
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        log('Caches:', keys)
        return Promise.all(
          keys
            .filter(function (key) {
              return !key.startsWith(version)
            })
            .map(function (key) {
              log('Remove cache:', key)
              return caches.delete(key)
            })
        )
      })
      .then(function () {
        log('Activation completed!')
      })
  )
})

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') {
    log('Fetch event ignored', event.request.method, event.request.url)
    return
  }
  event.respondWith(
    caches
      .match(event.request)
      .then(function (cached) {

        // First try network fetch, then cache if failed
        let networked = fetch(event.request)
          .then(fetchedFromNetwork, loadFromCache)
          .catch(loadFromCache)

        return networked

        // // First try cache, then network (no update)
        // if (cached) {
        //   log('Fetch result: (🟡 cached)', event.request.url)
        //   return cached
        // } else {
        //   // If not in cache, try network
        //   log('Fetching from network...')
        //   return networked = fetch(event.request)
        //     .then(fetchedFromNetwork, unableToResolve)
        //     .catch(unableToResolve)
        // }

        function fetchedFromNetwork (response) {
          const cacheCopy = response.clone()
          log('Fetch result: (🟢 network)', event.request.url)
          caches
            .open(version)
            .then(function add (cache) {
              cache.put(event.request, cacheCopy)
            })
            .then(function () {
              // log('Store in cache:', event.request.url)
            })
          return response
        }

        function unableToResolve () {
          log('Fetch result: (🔴 failed)', event.request.url)
          return new Response('<h1>StatSim: Service Unavailable</h1><p>The page is not cached. Check your network connection.</p>', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/html'
            })
          })
        }

        function loadFromCache () {
          if (cached) {
            log('Fetch result: (🟡 cached)', event.request.url)
            return cached
          } else {
            return unableToResolve()
          }
        }
      }) // *caches.match.then
  ) // *respondwith
})
