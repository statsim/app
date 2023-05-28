<style>

</style>
<template>
  <div class="parameters">
    <v-chip-group>
      <v-chip 
        v-for="b in models[activeModel].blocks" 
        :key="b.name" 
        :style="{background: colors[b.typeCode]}"
      >{{ b.name || b.type }}</v-chip>
    </v-chip-group>
    <p style="font-size:11px;">Model:</p>
    <h2>{{ models[activeModel].modelParams.name }}</h2>
    <p class="model-description">{{ models[activeModel].modelParams.description }}</p>
    <template
      v-for="b in models[activeModel].blocks" 
      :key="b.id"
      >
      <div v-if="b.typeCode === 2 && b.useAsParameter"> 
        <!-- Boolean -->
        <v-checkbox 
          v-if="b.dataType === 'boolean'"
          v-model="b.value"
          :label="b.name"
        ></v-checkbox>

        <!-- Numeric -->
        <template
          v-else-if="(b.dataType === 'integer' || b.datatype === 'float')"
        > 
          <!-- Numeric with min/max -->
          <v-slider
            v-if="b.min !== b.max"
            v-model="b.value"
            :max="b.max"
            :min="b.min"
            :step="b.step ? b.step : (b.dataType == 'integer' ? 1 : 0.1)"
            :label="b.name"
            hide-details
            >
            <template v-slot:append>
              <v-text-field
                v-model="b.value"
                type="number"
                style="width: 80px"
                density="comfortable"
                hide-details
                variant="outlined"
              ></v-text-field>
            </template>
          </v-slider>
          <!-- Numeric without min/max -->
          <v-text-field
            v-else
            v-model="b.value"
            :label="b.name"
            density="comfortable"
            variant="outlined"
            type="number"
            clearable
          ></v-text-field>
        </template>

        <!-- Categorical -->
        <v-select
          v-else-if="b.dataType === 'category'"
          v-model="b.value"
          :label="b.name"
          :items="b.dataCategories ? b.dataCategories.split(',').map(cat => cat.trim()) : ['']"
          density="comfortable"
        ></v-select>

        <!-- Proxy -->
        <!-- 
        <v-select
          v-else-if="b.dataType === 'proxy'"
          v-model="b.value"
        >
          <template v-slot:item="{ item }">
            <v-list-item-content>{{ item }}</v-list-item-content>
          </template>
          <template v-for="mod in models.filter(m => (m.modelParams.type && (m.modelParams.type === 'dataframe')))" v-if="mod.data">
            <v-list-item v-for="c in mod.data[0].filter(c => c).reduce((a, c) => a.concat(c), [])" :value="mod.modelParams.name + '.' + c" :key="c"></v-list-item>
          </template>
        </v-select>
        -->

        <!-- String -->
        <v-text-field
          v-else
          v-model="b.value"
          :label="b.name"
          density="comfortable"
          variant="outlined"
          clearable
        ></v-text-field>
      </div>
    </template>
  </div>
</template>
<script>
  import colors from '../lib/blockColors'
  export default {
    data () {
      return {
        colors
      }
    },
    props: [
      'models',
      'activeModel',
    ]
  } 
</script>