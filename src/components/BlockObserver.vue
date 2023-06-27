<template>
  <v-card-text>
    <!-- Data -->
    <v-text-field 
      label="Observed data"
      v-model="block.value" 
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
  </v-card-text>
</template>

<script>
const distributions = require('../lib/distributions')
export default {
  data: () => ({
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