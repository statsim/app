<template>
  <v-card-text>
    <!-- Name -->
    <v-text-field 
      label="Name"
      v-model="block.name" 
      clearable 
      density="compact"
    ></v-text-field>

    <!-- Distribution type -->
    <v-select 
      label="Distribution" 
      v-model="block.distribution" 
      :items="Object.keys(distributions)"
      density="compact"
    ></v-select>

    <!-- Distribution parameters -->
    <div 
      :class="{'d-flex': Object.keys(params).length === 2}"    
    >
      <v-text-field
        v-if="block.distribution.length"
        v-for="(paramOptions, param) in params"
        :label="param"
        v-model="block.params[param]"
        clearable 
        density="compact"
      ></v-text-field>
    </div>

    <!-- Units and shape -->
    <div class="d-flex">
      <!-- Units --> 
      <v-select 
        label="Units" 
        v-model="block.units" 
        :items="units"
        density="compact"
      ></v-select> 
      <!-- Shape -->
      <v-text-field 
        label="Shape"
        v-model="block.dims" 
        clearable 
        density="compact"
      ></v-text-field>
    </div>

    <!-- Visualization flag -->
    <v-checkbox 
      v-model="block.show" 
      label= "Show in results"
      density="compact"
      true-icon="mdi-eye-circle"
      false-icon="mdi-circle-outline"
      hide-details
    ></v-checkbox> 

  </v-card-text>
</template>

<script>
import Qty from 'js-quantities/esm'
const distributions = require('../lib/distributions')
export default {
  data: () => ({
    units: Qty.getUnits(),
    distributions,
  }),
  computed: {
    params() {
      return distributions[this.block.distribution]
    }
  },
  props: ['block'],
}
</script>