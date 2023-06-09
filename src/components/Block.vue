<style scoped>
.handle {
  cursor: move;
  position: absolute;
  left: 0;
  top: 15px;
  font-size: 18px;
  color: rgba(0,0,0,0.3);
}
.handle:hover {
  color: black;
}

.v-card-title {
  margin-bottom: 0;
  padding-bottom: 0px !important;
}
.v-card-subtitle {
  font-size: 0.675rem !important;
}
.v-toolbar-title {
  margin-top: -10px;
}
.v-toolbar-subtitle {
  position: absolute;
  left: 17px;
  bottom: 2px;
  font-size: 8px;
  color: rgba(0,0,0,0.4);
}
</style>

<template>
  <!--
    `id` is used by graph selection and testing
    not sure why, but `id` in props is optional for dev builds
    in production (minimization + babel) it is required
  -->
  <v-card
    :id="id"
    class="mx-auto"
    :class="['block', 'block-' + block.typeCode, block.minimized ? 'block-minimized' : 'block-full']"
  >
    <v-toolbar 
      density="compact" 
      :style="{background: colors[block.typeCode]}"
      @dblclick="$emit('toggleBlock', blockIndex)"
    >
      <span 
        class="handle mdi mdi-drag-vertical"
      ></span>
      <v-toolbar-title class="text-h6">
        {{ block.name ? block.name : block.type }}
      </v-toolbar-title>
      <div class="v-toolbar-subtitle">
        {{ block.type }}
      </div>
      <v-btn
        size="small"
        :icon="block.minimized ? 'mdi-arrow-expand-vertical' : 'mdi-arrow-collapse-vertical'"
        @click="$emit('toggleBlock', blockIndex)"
      ></v-btn>
      <template v-slot:append>
        <v-menu>
          <template v-slot:activator="{ props }">
            <v-btn icon="mdi-dots-vertical" v-bind="props"></v-btn>
          </template>
          <v-list>
            <!-- ^ -->
            <v-list-item
              key="0"
              @click="$emit('moveBlockToTop', blockIndex)"
            >
              <v-list-item-title> 
                <v-icon size="x-small" color="#DDD">mdi-arrow-up</v-icon> 
                Move to top
              </v-list-item-title>
            </v-list-item>
            <!-- [] -->
            <v-list-item
              key="1"
              @click="$emit('cloneBlock', blockIndex)"
            >
              <v-list-item-title> 
                <v-icon size="x-small" color="#DDD">mdi-content-copy</v-icon> 
                Clone block
              </v-list-item-title>
            </v-list-item>
            <!-- X -->
            <v-list-item
              key="2"
              @click="$emit('removeBlock', blockIndex)"
            >
              <v-list-item-title> 
                <v-icon size="x-small" color="#DDD">mdi-delete</v-icon> 
                Delete
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </v-toolbar>

    <template 
      v-if="!block.minimized"
      >
      <s-block-variable :block="block" v-if="block.typeCode === 0"></s-block-variable>
      <s-block-expression :block="block" v-if="block.typeCode === 1"></s-block-expression>
      <s-block-data :block="block" v-if="block.typeCode === 2"></s-block-data>
      <s-block-accumulator :block="block" v-if="block.typeCode === 3"></s-block-accumulator>
      <s-block-condition :block="block" v-if="block.typeCode === 5"></s-block-condition>
      <s-block-optimize :block="block" v-if="block.typeCode === 8"></s-block-optimize>
    </template>
  </v-card>
</template>

<script>
import BlockData from './BlockData.vue'
import BlockVariable from './BlockVariable.vue'
import BlockExpression from './BlockExpression.vue'
import BlockAccumulator from './BlockAccumulator.vue'
import BlockOptimize from './BlockOptimize.vue'
import BlockCondition from './BlockCondition.vue'

import colors from '../lib/blockColors.js'

export default {
  data() {
    return {
      colors: colors,
    }
  },
  components: {
    's-block-variable': BlockVariable,
    's-block-data': BlockData,
    's-block-expression': BlockExpression,
    's-block-accumulator': BlockAccumulator,
    's-block-optimize': BlockOptimize,
    's-block-condition': BlockCondition,
  },
  props: ['block', 'blockIndex', 'id'],
}
</script>