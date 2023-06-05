<template>
  <v-card-text>
    <!-- Value -->
    <v-text-field
      label="Optimization target" 
      v-model="block.value" 
      density="compact"
    ></v-text-field>
  </v-card-text>
  <v-select 
    label="Optimization type" 
    v-model="block.optimizationType" 
    :items="['minimize', 'maximize']"
    density="compact"
  ></v-select>
</template>

<script>
  export default {
    props: ['block']
  }
</script>