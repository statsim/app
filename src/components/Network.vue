<style> 
</style>
<template>
  <div id="mynetwork"></div>
</template>
<script>
  import { DataSet, Network } from "vis-network/standalone"
  import { defineComponent } from "vue"
  import colors from '../lib/blockColors'

  const distributions = require('../lib/distributions')
  const expressions = require('../lib/expressions')
  
  // Defining network here rather than in `data` to prevent proxifying by Vue
  // TypeError: Cannot read private member from an object whose class did not declare it
  let network

  // Network options object
  const networkOptions = {
    autoResize: true,
    height: '100%',
    width: '100%',
    locale: 'en',
    nodes: {
      shape: 'dot',
      font: {
        size: 11,
        multi: true,
        color: '#777777'
      },
      /*
      scaling: {
        min: 5,
        max: 60,
      },
      */
      borderWidth: 0,
      shadow: false,
      margin: {
        top: 10,
        left: 20,
        right: 20,
        bottom: 10
      },
      color: {
        border: '',
        background: '#b2dfdb',
        highlight: {
          border: '#e57373',
          background: '#ffcdd2'
        }
      }
    },
    layout: {
      improvedLayout: true,
      hierarchical: {
        enabled: false,
        direction: 'LR',
        sortMethod: 'directed',
        shakeTowards: 'roots'
        // sortMethod: 'hubsize',
        // parentCentralization: true,
        // blockShifting: true,
        // edgeMinimization: true
      }
    },
    edges: {
      smooth: true,
      chosen: true,
      arrows: {
        to: {
          enabled: true,
          type: 'arrow'
        }
      },
      color: {
        color: '#888',
        highlight: '#0042FF',
        hover: '#999',
        inherit: 'from',
        opacity: 0.5
      }
    },
    groups: {
      '0': {
        shape: 'triangle',
        color: colors[0], // RV
        size: 10
      },
      '1': {
        shape: 'dot',
        color: colors[1], // Exp
        size: 10
      },
      '2': {
        shape: 'dot',
        color: colors[2],
        size: 10 // Data
      },
      '3': {
        shape: 'icon',
        icon: {
          face: 'Material Icons',
          code: '\ue146',
          size: 30,
          color: colors[3]
        }
      },
      '4': {
        shape: 'diamond',
        color: colors[4], // observer
        size: 10
      },
      '5': {
        shape: 'icon',
        icon: {
          face: 'Material Icons',
          code: '\ue86c',
          size: 40,
          color: colors[5]
        }
      },
      '6': {
        shape: 'square',
        color: colors[6], // nn
        size: 15
      },
      '7': {
        shape: 'dot',
        color: colors[7], // function
        size: 10
      },
      '8': {
        shape: 'triangle',
        color: colors[4], // optimize
        size: 10
      },
      'shadow': {
        shape: 'dot',
        color: '#ababab', // shadow
        size: 10
      }
    },
    physics: {
      enabled: true,
      barnesHut: {
        gravitationalConstant: -2000
      }
    },
    interaction: {
      zoomView: false,
      navigationButtons: true
    }
  }

  let nodesPrev = null
  let edgesPrev = null

  export default {
    props: [
      // 'nodes',
      // 'edges',
      'models',
      'activeModel',
    ],
    computed: {
      shadowNodes: function () {
        // Stringify current blocks to easily search for variable
        // let blockString = JSON.stringify(this.models[this.activeModel].blocks)
        let sn = []
        // Check for shadow nodes only if multiple models
        if (this.models.length > 1) {
          console.log('[Shadow nodes] Start searching!')
          let blockString = JSON.stringify(this.models[this.activeModel].blocks).split(/[^A-Za-z0-9_]/g).filter(el => el.length)
          // Iterate over all non active models
          this.models.filter((_, i) => i !== this.activeModel).forEach((m, mi) => {
            // Check model first (shadow model)
            if (m.modelParams.name && (blockString.indexOf(m.modelParams.name) >= 0)) {
              sn.push({
                id: m.modelParams.name,
                label: m.modelParams.name,
                shape: 'icon',
                group: 'icon',
                icon: {
                  face: 'Material Icons',
                  code: '\ue886',
                  size: 60,
                  color: '#ababab'
                }
              })
            }
            // Check included model blocks and columns (shadow blocks)
            if (this.models[this.activeModel].modelParams.include && this.models[this.activeModel].modelParams.include.length) {
              let names
              if (m.modelParams.type && (m.modelParams.type === 'dataframe')) {
                // Dataframe
                if (m.data && m.data[0] && m.data[0].length) {
                  names = m.data[0]
                } else {
                  names = m.pipeline.source.columns
                }
              } else {
                // Regular model
                names = m.blocks.map(b => b.name)
              }

              // Iterate over names
              names.forEach((n, ni) => {
                if (n && (blockString.indexOf(n) >= 0)) {
                  sn.push({
                    id: n + ni,
                    label: n,
                    group: 'shadow'
                  })
                }
              })
            }
          }) // *iterate over all other models
        }
        // console.log(new Date(), 'Shadow nodes', sn)
        return sn
      },
      nodes: function () {
        // console.log(new Date(), 'Nodes: Starting dynamic update')
        const nodes = this.models[this.activeModel].blocks
          .map((b, i) => {
            let label = (b.name && b.name.length) ? `${b.name}` : b.type
            label = '<b>' + label + '</b>'
            if (b.typeCode <= 3 && b.value && b.value.length) {
              if (b.value.includes(',')) {
                // List
                label += `\n${b.value.split(',').length} items`
              } else {
                label += `\n${b.value}`
              }
            }
            let node = {
              id: i,
              label: label,
            }
            if (b.icon && b.icon.length) {
              node.group = 'icon'
              node.shape = 'icon'
              node.icon = {
                face: 'Material Icons',
                code: b.icon,
                size: b.size ? b.size : 40,
                color: (b.color && b.color.length) ? b.color : '#ababab'
              }
            } else {
              node.group = b.typeCode + '' // Stopped working with raw numbers
            }
            if (b.pos) {
              node.x = b.pos.x
              node.y = b.pos.y
              delete b.pos
            }
            return node
          })
          .concat(this.shadowNodes)
        // console.log(new Date(), 'Nodes: returning nodes', nodes)
        return nodes
      },
      edges: function () {
        // console.log(new Date(), 'Links: generating network links')
        const check = (str, baseBlockIndex) => {
          const l = []
          if (typeof str === 'string') {
            this.models[this.activeModel].blocks.forEach((b, i) => {
              if (b.name && (str.split(/[^A-Za-z0-9_\s]/g).map(s => s.trim()).indexOf(b.name.trim()) >= 0)) {
                l.push({
                  to: baseBlockIndex,
                  from: i
                })
              }
            })
            this.shadowNodes.forEach((s, i) => {
              if (s.label && (str.split(/[^A-Za-z0-9_\s]/g).map(s => s.trim()).indexOf(s.label.trim()) >= 0)) {
                l.push({
                  to: baseBlockIndex,
                  from: s.id
                })
              }
            })
          }
          return l
        }
        let links = []
        this.models[this.activeModel].blocks.forEach((b, i) => {
          switch (b.typeCode) {
            case 0: // RV
              // Load selected distribution / model
              const distr = distributions[b.distribution]
              if (distr) {
                // Iterate over its keys
                Object.keys(distr).forEach(k => {
                  // Check params=keys of the block
                  // Add result to links array
                  links = links.concat(check(b.params[k], i))
                })
                // Check dimensions too
                links = links.concat(check(b.dims, i))
              }
              break
            case 1: // Expression
              if (b.expressionType) {
                // Check custom expression params
                Object.keys(expressions[b.expressionType]).forEach(k => {
                  links = links.concat(check(b.params[k], i))
                })
              } else {
                // Check only value field
                links = links.concat(check(b.value, i))
              }
              break
            case 2: // Data
              links = links.concat(check(b.value, i))
              break
            case 3: // Accum
              links = links.concat(check(b.increment, i))
              links = links.concat(check(b.initialValue, i))
              break
            case 4: // Observer
              Object.keys(distributions[b.distribution]).forEach(k => {
                links = links.concat(check(b.params[k], i))
              })
              links = links.concat(check(b.value, i))
              if (b.customLoop) {
                links = links
                  .concat(check(b.loopStart, i))
                  .concat(check(b.loopEnd, i))
              }
              break
            case 5: // Condition
              links = links.concat(check(b.value, i))
              break
            case 8: // Optimize
              links = links.concat(check(b.value, i))
              break
          }
        })
        // console.log(new Date(), 'Links: returning links', links.length)
        return links
      }
    },
    mounted() {
      // create a network
      // Relying on `this` so not using arrow
      const container = document.getElementById("mynetwork");
      this.data = {
        nodes: this.nodes,
        edges: this.edges
      }
      network = new Network(container, this.data, networkOptions)
      window.network = network
      
      network.on('selectNode', (params) => {
        // Using arrow here to preserve `this` of the Vue component
        console.log('selectNode Event:', params)
        this.$emit('selectNode', params);
      });
    },
    watch: {
      // models() {
      //   this.updateNetworkData(this.nodes, this.edges)
      // },
      nodes(nodes) {
        this.updateNetworkData(nodes, this.edges)
      },
      edges(edges) {
        this.updateNetworkData(this.nodes, edges)
      }
    },
    methods: {
      updateNetworkData(nodes, edges) {
        network.setData({ nodes, edges })
      },
      getPositions(hierarchical=false) {
        if (hierarchical) {
          // Here is a trick: we create a new network with the same data
          // Make it hierarchical so that there's a natural flow from left to right
          // Then we stabilize it and get the positions
          // Later we will use this positions to create a flow-based representation
          const container = document.createElement('div')
          const networkOptionsHierarchical = JSON.parse(JSON.stringify(networkOptions))
          networkOptionsHierarchical.layout.hierarchical.enabled = true
          const networkHierarchical = new Network(
            container,
            {
              nodes: this.nodes,
              edges: this.edges
            },
            networkOptionsHierarchical
          )
          networkHierarchical.stabilize()
          return networkHierarchical.getPositions()
        } 
        return network.getPositions()
      },
    },
  }
</script>