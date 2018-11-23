const Vue = require('vue')
const material = require('vue-material')
const app = require('./app.vue')

Vue.use(material)

const vm = new Vue({
  el: '#app',
  render: f => f(app)
})

if (!vm) {
  throw new Error(`Browser: Where the fuck is Vue?`)
}
