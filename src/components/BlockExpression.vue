<template>
  <v-card-text>
    <!-- Name -->
    <v-text-field 
      label="Name"
      v-model="block.name"
      clearable 
      density="compact"
    ></v-text-field>
    
    <!-- Expression type -->
    <v-select 
      label="Expression type" 
      v-model="block.expressionType" 
      :items="Object.keys(expressions)"
      density="compact"
    ></v-select>

    <!-- Expression parameters -->
    <div 
      :class="{'d-flex': params.length === 2}"    
    >
      <v-text-field
        v-if="block.expressionType.length"
        v-for="param in params"
        :label="param"
        v-model="block.params[param]"
        clearable 
        density="compact"
      ></v-text-field>
    </div>

    <!-- Units and data type -->
    <div class="d-flex"> 
      <!-- Units --> 
      <v-select 
        label="Units" 
        v-model="block.units" 
        :items="units"
        density="compact"
      ></v-select> 
      <!-- Data type --> 
      <v-select 
        label="Type" 
        v-model="block.dataType" 
        :items="['auto', 'proxy', 'boolean', 'integer', 'float', 'string', 'category', 'array', 'vector', 'tensor']"
        density="compact"
      ></v-select> 
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

const expressions = require('../lib/expressions')

export default {
  data: () => ({
    units: Qty.getUnits(), // No need to have {name: 'name'} format
    expressions,
  }),
  computed: {
    params() {
      return Object.keys(expressions[this.block.expressionType])
    }
  },
  props: ['block']
}
</script>