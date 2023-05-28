// const Vue = require('vue')
// const { createApp, h } = require('vue')
// const material = require('vue-material')
// const App = require('./app.vue')

// Vue.use(material)
// const vm = new Vue({
//   el: '#app',
//   render: f => f(app)
// })

// const app = createApp({
//   render: () => h(App)
// })



/*
const { createApp } = window.Vue
*/
import { createApp, h } from 'vue'

/*
*/
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, mdi } from 'vuetify/iconsets/mdi'

import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

const vuetify = createVuetify({
  components,
  directives,
  theme: {
    defaultTheme: 'light'
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: {
      mdi,
    },
  },
})

/*
const { createVuetify } = window.Vuetify
const components = Vuetify.components
const directives = Vuetify.directives
console.log('components', components)
const vuetify = createVuetify()
*/

// in your main.js


import App from './app.vue'
const app = createApp(App)

// Plugins
app.use(vuetify) 

app.mount('#app')
