<template>
  <v-card-text>
    <!-- Value -->
    <v-text-field
      label="Value" 
      v-model="block.value" 
      density="compact"
    ></v-text-field>
  </v-card-text>
</template>

<script>
  export default {
    props: ['block']
  }
</script>