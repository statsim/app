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
      v-if="block.dataType !== 'boolean'" 
      label="Value" 
      v-model="block.value" 
      density="compact"
    ></v-text-field>
    <v-select 
      v-else 
      label="Value" 
      v-model="block.value" 
      :items="['true', 'false']"
      density="compact"
    ></v-select>

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

    <!-- Min/Max range -->
    <template
      v-if="['auto', 'integer', 'float'].includes(block.dataType) || ['auto', 'integer', 'float'].includes(block.elType)" 
    >
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
    </template>

    <!-- Categories -->
    <template 
      v-if="block.dataType === 'category'"
    >
      <v-text-field
        label="Categories (comma separated)"
        v-model="block.dataCategories" 
        density="compact"
      ></v-text-field> 
    </template>

    <!-- Use as input -->
    <v-checkbox 
      v-model="block.useAsParameter" 
      label= "Use as model input"
      density="compact"
      true-icon="mdi-arrow-right-circle"
      false-icon="mdi-circle-outline"
      hide-details
    ></v-checkbox> 

    <!-- TODO: Is there a case when we want data to be visualized? -->
    <!--
      <v-checkbox 
      v-model="block.show" 
      label= "Show in results"
      density="compact"
      ></v-checkbox>
    -->

    <!-- Expander -->
    <v-card-actions>
      <v-btn variant="text">
        Information
      </v-btn>
      <v-spacer></v-spacer>
      <v-btn
        :icon="show ? 'mdi-chevron-up' : 'mdi-chevron-down'"
        @click="show = !show"
      ></v-btn>
    </v-card-actions>

    <v-expand-transition>
      <div v-show="show">
        <v-divider></v-divider>
        <!-- TODO: Dynamic description -->
        <v-card-text>
          I'm a thing. But, like most politicians, he promised more than he could deliver. You won't have time for sleeping, soldier, not with all the bed making you'll be doing. Then we'll go with that data file! Hey, you add a one and two zeros to that or we walk! You're going to do his laundry? I've got to find a way to escape.
        </v-card-text>
      </div>
    </v-expand-transition>

  </v-card-text>
</template>

<script>
import Qty from 'js-quantities/esm'

export default {
  data: () => ({
    units: Qty.getUnits(), // No need to have {name: 'name'} format
    show: false
  }),
  props: ['block']
}
</script>