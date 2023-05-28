<style>
  .v-navigation-drawer {
    transition: none !important;
  }
  .resize-handle {
    position: absolute;
    right: -10px;
    top: 0;
    bottom: 0;
    width: 10px;
    cursor: col-resize;
    z-index: 1;
  }
  .resize-handle:hover {
    background-color: rgba(0,0,0,0.1);
  }
  .add-block-here {
    height: 10px;
    width: 100%;
    background-color: white;
    margin: 2px 0 0 0;
    padding: 2px;
    line-height: 6px;
    font-size: 10px;
    display: block;
    text-align: center;
    border-radius: 2px;
    color: #EEE;
    cursor: pointer;
  }
  .add-block-here:hover {
    background-color: rgb(241, 241, 241);
    content: 'Add block here';
    color: rgb(114, 114, 114)
  }

  @media screen and (max-width: 1264px) {
    .sidebar {
      /* on mobile make it block without absolute position */
      position: relative !important;
      width: 100% !important;
      transform: none !important;
    }
  }
</style>

<template>
  <v-navigation-drawer
    :width="drawerWidth"
    class="sidebar"
    id="sidebar"
    location="left"
  >
    <v-toolbar 
      color="primary"
      location="top"
      dense
      fixed
    >
      <v-toolbar-title>Blocks</v-toolbar-title>
      <v-spacer></v-spacer>
      <s-block-menu
        :items="items"
        @addBlock="addBlock"
      ></s-block-menu>
    </v-toolbar>


    
    <!-- Hide / Show all blocks-->
    <v-container style="opacity: 0.4" v-if="models[activeModel]?.blocks?.length">
      <v-row justify="center">
        <v-col cols="auto">
      <v-btn 
        @click="$emit('minimizeAllBlocks')" 
        density="compact"
      >
        <v-icon>mdi-arrow-collapse-vertical</v-icon>
        Hide all
      </v-btn>
        </v-col>
        <v-col cols="auto">
      <v-btn 
        @click="$emit('maximizeAllBlocks')"
        density="compact"
      >
        <v-icon>mdi-arrow-expand-vertical</v-icon>
        Show all
      </v-btn>

        </v-col>
      </v-row>
    </v-container>

    <!-- Possibly model selector? -->
    <!-- 
    <v-container>
      <v-card>
        <v-tabs
          bg-color="deep-purple-darken-4"
          center-active
          density="compact"
        >
          <v-tab>One</v-tab>
          <v-tab>Two</v-tab>
        </v-tabs>
      </v-card>
    </v-container>
    -->

    <v-container>
      <draggable 
        v-model="models[activeModel].blocks" 
        group="blocks" 
        @start="drag=true" 
        @end="drag=false" 
        item-key="id"
        handle=".handle"
      >
        <template #item="{element, index}">
          <v-row dense>
            <v-col 
              cols="12"
              style="padding-bottom: 0px !important; padding-top: 0px !important;"
            >
              <s-block 
                :id="'block-id-' + activeModel + '-' + index"
                :block="element"
                :block-index="index"
                @toggleBlock="toggleBlock"
                @moveBlockUp="moveBlockUp"
                @moveBlockDown="moveBlockDown"
              ></s-block>

    <v-menu>
      <template v-slot:activator="{ props }">
        <a v-bind="props" class="add-block-here"> + </a>
      </template>
      <v-list>
        <v-list-item
          v-for="item in items"
          :key="item.code"
          :value="item.code"
        >
          <v-btn @click="addBlock(item.code, index)" block plain> {{ item.name }}</v-btn>
        </v-list-item>
      </v-list>
    </v-menu>

    <!-- 

              <a 
                class="add-block-here"
              >+
              </a>

     -->
            </v-col>

          </v-row>

         </template>
      </draggable>
      <!-- 
    <draggable :list="test" item-key="id" group="blocks">
      <template #item="{element}">
        <div> 
          {{ element.name }}
        </div>
        <s-block 
        :block="block"
        :block-index="blockIndex"
        @toggleBlock="toggleBlock"
        @moveBlockUp="moveBlockUp"
        @moveBlockDown="moveBlockDown"
        ></s-block>
      </template>
    </draggable>
  -->
    </v-container>

    <!-- 

    <v-container>
      <v-row dense v-for="(block, blockIndex) in models[activeModel].blocks">
        <v-col cols="12">
          <s-block 
            :block="block"
            :block-index="blockIndex"
            @toggleBlock="toggleBlock"
            @moveBlockUp="moveBlockUp"
            @moveBlockDown="moveBlockDown"
          ></s-block>
        </v-col>
      </v-row>
    </v-container>
    -->
    <div
      class="resize-handle"
      @mousedown.prevent="resizeStart"
    ></div>
  </v-navigation-drawer>
</template>

<script>
import Block from './Block.vue'
import BlockMenu from './BlockMenu.vue'

import draggable from 'vuedraggable'

export default {
  data: () => ({
    drag: false,
    drawerWidth: 300, 
    items: [
      {name: 'Input', code: 2},
      {name: 'Variable', code: 0},
      {name: 'Expression', code: 1},
      {name: 'Accumulator', code: 3},
      {name: 'Observer', code: 4},
      {name: 'Condition', code: 5},
      {name: 'Function', code: 7},
      {name: 'Optimize', code: 8},
    ],
    test: [{'id': 1, 'name': 'test1'}, {'id': 2, 'name': 'test2'}]
  }),
  computed: {
  },
  components: {
    's-block': Block,
    's-block-menu': BlockMenu,
    draggable,
  },
  props: [
    'models', 
    'activeModel',
  ],
  methods: {
    resizeStart(event) {
      document.addEventListener('mousemove', this.resize);
      document.addEventListener('mouseup', this.resizeEnd);
    },
    resize(event) {
      // TODO: disable transition in .v-navigation-drawer
      this.drawerWidth = event.clientX;
    },
    resizeEnd(event) {
      document.removeEventListener('mousemove', this.resize);
      document.removeEventListener('mouseup', this.resizeEnd);
    },
    addBlock: function (typeCode, blockIndex) {
      this.$emit('addBlock', typeCode, blockIndex)
    },
    toggleBlock: function (blockIndex) {
      this.$emit('toggleBlock', blockIndex)
    },
    moveBlockUp: function (blockIndex) {
      this.$emit('moveBlockUp', blockIndex)
    },
    moveBlockDown: function (blockIndex) {
      this.$emit('moveBlockDown', blockIndex)
    },
  }
}
</script>