<style> 
</style>
<template>
  <div id="mynetwork"></div>
</template>
<script>
  import { DataSet, Network } from "vis-network/standalone"
  import { defineComponent } from "vue"
  import colors from '../lib/blockColors'
  
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
        size: 14,
        color: '#000000'
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
        direction: 'UD',
        sortMethod: 'hubsize',
        parentCentralization: true,
        blockShifting: true,
        edgeMinimization: true
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

  export default {
    props: [
      'nodes',
      'edges',
    ],
    mounted() {
      // create a network
      // Relying on `this` so not using arrow
      const container = document.getElementById("mynetwork");
      this.data = {
        nodes: this.nodes,
        edges: this.edges
      }
      network = new Network(container, this.data, networkOptions);
      console.log(network)
      network.on('selectNode', (params) => {
        // Using arrow here to preserve `this` of the Vue component
        console.log('selectNode Event:', params)
        this.$emit('selectNode', params);
      });
    },
    watch: {
      nodes(newNodes) {
        this.updateNetworkData(newNodes, this.edges)
      },
      edges(newEdges) {
        this.updateNetworkData(this.nodes, newEdges)
      },
    },
    methods: {
      updateNetworkData(nodes, edges) {
        network.setData({ nodes, edges })
      },
    },
  }
</script>