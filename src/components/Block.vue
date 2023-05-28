<style>
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
    id is used by graph selection
  -->
  <v-card
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
        {{ block.name }}
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
            <v-list-item
              v-for="(item, i) in ['Minimize', 'Delete']"
              :key="i"
            >
              <v-list-item-title
                @click="$emit('blockAction', item.toLowerCase())"
              >{{ item }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </v-toolbar>

    <s-block-variable :block="block" v-if="block.typeCode === 0 && !block.minimized"></s-block-variable>
    <s-block-data :block="block" v-if="block.typeCode === 2 && !block.minimized"></s-block-data>
  </v-card>
</template>

<script>
import BlockData from './BlockData.vue'
import BlockVariable from './BlockVariable.vue'
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
  },
  props: ['block', 'blockIndex'],
}
</script>