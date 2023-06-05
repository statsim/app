<template>
  <v-card-text>
    <!-- Name -->
    <v-text-field 
      label="Name"
      v-model="block.name"
      clearable 
      density="compact"
    ></v-text-field>
    
    <!-- Value -->
    <v-text-field
      label="Increment" 
      v-model="block.value" 
      density="compact"
    ></v-text-field>

    <!-- Initial value -->
    <v-text-field 
      label="Initial value"
      v-model="block.initialValue"
      clearable 
      density="compact"
    ></v-text-field>

    <div class="d-flex">
      <!-- Min -->
      <v-text-field
        label="Min" 
        v-model="block.min" 
        density="compact"
      ></v-text-field>
      <!-- Max -->
      <v-text-field
        label="Max" 
        v-model="block.max" 
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
    <!-- Track history ot only last value -->
    <v-checkbox
      v-model="block.history"
      label="Track history"
      color="primary"
      hide-details
    ></v-checkbox>


  </v-card-text>
</template>

<script>
import Qty from 'js-quantities/esm'

export default {
  data: () => ({
    units: Qty.getUnits(), // No need to have {name: 'name'} format
  }),
  props: ['block']
}
</script>