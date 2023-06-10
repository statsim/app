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

  .v-expansion-panel {
    border-bottom: 1px solid rgba(0,0,0,0.1);
  }

  .v-expansion-panel-title {
    padding: 10px 15px !important;
    min-height: 40px;
  }

  .v-expansion-panel-text {
    padding: 15px 0;
  }

  .v-expansion-panel--active > .v-expansion-panel-title {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    min-height: 40px;
  }

  .v-expansion-panel--active:not(:first-child), .v-expansion-panel--active + .v-expansion-panel {
    margin-top: 0;
  }

  .v-textarea .v-field__input {
    -webkit-mask-image: none !important;
    mask-image: none !important;
  }

  .v-expansion-panel-text__wrapper {
    padding: 5px 15px 16px;
  }

  @media screen and (max-width: 1264px) {
    .sidebar {
      /* on mobile make it block without absolute position */
      position: relative !important;
      width: 100% !important;
      transform: none !important;
    }
    .add-block-here {
      height: 20px;
      padding-top: 7px;
      font-size: 12px;
      color: #BBB;
    }
  }
</style>

<template>
  <v-navigation-drawer
    :width="sidebarWidth"
    class="sidebar"
    id="sidebar"
    location="left"
  >

    <!-- 

    <v-toolbar 
      color="primary"
      location="top"
      dense
      fixed
      density="compact"
    >
    <v-tabs
      bg-color="deep-purple-darken-4"
      center-active
      density="compact"
    >
      <v-tab>Main</v-tab>
      <v-tab>Data</v-tab>
      <v-tab>Data</v-tab>
    </v-tabs>
    <v-spacer></v-spacer>

  </v-toolbar>
-->



    


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


    <v-expansion-panels
      v-model="panel"
      multiple
      density="compact"
    >
      <v-expansion-panel>
        <v-expansion-panel-title>Model details</v-expansion-panel-title>
        <v-expansion-panel-text>
          <!-- Name -->
          <v-text-field 
            label="Model name"
            v-model="models[activeModel].modelParams.name" 
            clearable 
            density="compact"
          ></v-text-field>
          <v-textarea 
            label="Description"
            v-model="models[activeModel].modelParams.description"
            density="compact"
          ></v-textarea>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel
        v-if="!(models[activeModel].modelParams.type && ['dataframe', 'flow'].includes(models[activeModel].modelParams.type))"
      >
        <v-expansion-panel-title>
          Blocks         
          <v-badge
            color="#AAA"
            :content="models[activeModel].blocks.length"
            inline
          ></v-badge>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div>
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
                      @removeBlock="removeBlock"
                      @cloneBlock="cloneBlock"
                      @toggleBlock="toggleBlock"
                      @moveBlockToTop="moveBlockToTop"
                      @moveBlockUp="moveBlockUp"
                      @moveBlockDown="moveBlockDown"
                    ></s-block>
                    <v-menu>
                      <template v-slot:activator="{ props }">
                        <a 
                          v-if="index < models[activeModel].blocks.length - 1"
                          v-bind="props" 
                          class="add-block-here"
                        > + </a>
                      </template>
                      <v-list>
                        <v-list-item
                          v-for="item in items"
                          :key="item.code"
                          :value="item.code"
                          @click="addBlock(item.code, index)"
                        >
                          <v-list-item-title>
                            <v-icon size="x-small" color="#DDD">mdi-plus</v-icon> {{ item.name }}
                          </v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </v-menu>
                  </v-col>
                </v-row>
               </template>
            </draggable>
          </div>

          <div style="margin-top: 15px; padding-top: 0px;">
            <v-menu>
              <template v-slot:activator="{ props }">
                <v-btn
                  id="btn-add-block"
                  v-bind="props" 
                  size="small" 
                  variant="outlined"
                  block 
                  style="border: 1px dashed #CCC; height: 48px"
                >
                  <v-icon>mdi-plus</v-icon>
                  Add block
                </v-btn>
              </template>
              <v-list>
                <v-list-item
                  class="menu-add-block"
                  v-for="item in items"
                  :key="item.code"
                  :value="item.code"
                  @click="addBlock(item.code, index)"
                >
                  <v-list-item-title>
                    <v-icon size="x-small" color="#DDD">mdi-plus</v-icon> 
                    {{ item.name }}
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>

      <v-expansion-panel
        v-if="!(models[activeModel].modelParams.type && ['dataframe', 'flow'].includes(models[activeModel].modelParams.type))"
      >
        <v-expansion-panel-title>
          Output
          <v-badge
            color="#AAA"
            :content="models[activeModel].blocks.filter(block => block.show).length"
            inline
          ></v-badge>
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div>
            <div
              v-for="block in models[activeModel].blocks" 
            >
              <v-checkbox
                v-if="block.hasOwnProperty('show')" 
                v-model="block.show"
                :label="block.name"
                density="compact"
              ></v-checkbox>
            </div>
          </div>  
        </v-expansion-panel-text>
      </v-expansion-panel>
      
      <v-expansion-panel
        v-if="!(models[activeModel].modelParams.type && ['dataframe'].includes(models[activeModel].modelParams.type))"
      >
        <v-expansion-panel-title>
          Engine settings
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div>
            <!-- Simulation method -->
            <v-select
              v-model="models[activeModel].modelParams.method"
              :items="Object.keys(simulationMethods)"
              label="Simulation method"
              item-text="name"
              item-value="method"
              outlined
              density="compact"
            ></v-select>
            
            <!-- Number of chains -->
            <v-text-field
              v-if="!['deterministic', 'smt'].includes(models[activeModel].modelParams.method)"
              label="Number of chains/workers"
              type="number"
              step="1"
              v-model="models[activeModel].methodParams.chains"
              outlined
              density="compact"
            ></v-text-field>
            
            <!-- Simulation settings -->
            <!-- Method parameters -->
            <div
              class="method-param"
              v-for="(paramOptions, param) in simulationMethods[models[activeModel].modelParams.method].params"
              :key="param"
            >
              <!-- Boolean -->
              <v-checkbox 
                :label="param"
                v-model="models[activeModel].methodParams[param]"
                v-if="paramOptions.type === 'boolean'"
                density="compact"
              ></v-checkbox>
              <!-- Number-->
              <v-text-field
                v-else-if="(paramOptions.type === 'int') || (paramOptions.type === 'real')"
                :label="param"
                type="number"
                :step="(paramOptions.type === 'int') ? 1 : 0.001"
                v-model="models[activeModel].methodParams[param]"
                outlined
                density="compact"
              ></v-text-field>
              <!-- Select -->
              <v-select
                v-else-if="paramOptions.type === 'select'"
                :label="param"
                v-model="models[activeModel].methodParams[param]"
                :items="paramOptions.values"
                outlined
                density="compact"
              ></v-select>
            </div>
          </div>  
        </v-expansion-panel-text>
      </v-expansion-panel>

    </v-expansion-panels>

    <!-- Remove / Clone-->
    <!--
    <v-container style="opacity: 0.4">
      <v-row justify="center">
        <v-col cols="auto">
          <v-btn 
            @click="minimizeAllBlocks" 
            density="compact"
          >
            <v-icon>mdi-content-copy</v-icon>
          </v-btn>
            </v-col>
            <v-col cols="auto">
          <v-btn 
            @click="maximizeAllBlocks"
            density="compact"
          >
            <v-icon>mdi-delete-alert</v-icon>
          </v-btn>
        </v-col>
      </v-row>
    </v-container> 
    -->

    <!-- Hide / Show all blocks-->
    <!-- 
    <v-container style="opacity: 0.4" v-if="models[activeModel]?.blocks?.length">
      <v-row justify="center">
        <v-col cols="auto">
      <v-btn 
        @click="minimizeAllBlocks" 
        density="compact"
      >
        <v-icon>mdi-arrow-collapse-vertical</v-icon>
      </v-btn>
        </v-col>
        <v-col cols="auto">
      <v-btn 
        @click="maximizeAllBlocks"
        density="compact"
      >
        <v-icon>mdi-arrow-expand-vertical</v-icon>
      </v-btn>

        </v-col>
      </v-row>
    </v-container> 
    -->

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
import draggable from 'vuedraggable'

import Block from './Block.vue'
import BlockMenu from './BlockMenu.vue'

const BlockClasses = require('../lib/blockClasses')
const simulationMethods = require('../lib/methods')

export default {
  data: () => ({
    panel: [1],
    drag: false,
    // drawerWidth: 300, 
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
    simulationMethods: simulationMethods,
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
    'sidebarWidth'
  ],
  methods: {
    maximizeAllBlocks () {
      this.panel = [0,1,2,3]
      this.models[this.activeModel].blocks.forEach(b => { b.minimized = false })
    },
    minimizeAllBlocks () {
      this.panel = []
      this.models[this.activeModel].blocks.forEach(b => { b.minimized = true })
    },
    resizeStart(event) {
      document.addEventListener('mousemove', this.resize);
      document.addEventListener('mouseup', this.resizeEnd);
    },
    resize(event) {
      // TODO: disable transition in .v-navigation-drawer
      // this.sidebarWidth = event.clientX;
      this.$emit('update:sidebarWidth', event.clientX)
    },
    resizeEnd(event) {
      document.removeEventListener('mousemove', this.resize);
      document.removeEventListener('mouseup', this.resizeEnd);
    },
    addBlock (blockClassNumber, blockIndex) {
      let block = new BlockClasses[blockClassNumber](this.models[this.activeModel].blocks.length)
      block.minimized = false
      block.id = 'b' + Math.round(Math.random() * 100000000)
      if (blockIndex !== undefined) {
        this.models[this.activeModel].blocks.splice(blockIndex + 1, 0, block)
      } else {
        this.models[this.activeModel].blocks.push(block)
      }
      // If data added, update table
      if ((blockClassNumber === 2) && this.models[this.activeModel].modelParams.table) {
        this.renderDataTable()
      } else if ((blockClassNumber === 0) && (this.models[this.activeModel].modelParams.method === 'deterministic') && (this.models[this.activeModel].blocks.filter(b => b.typeCode === 0).length === 1)) {
        // Random variable added
        // Should we check the simulation method?
        // Probably yes!
        this.models[this.activeModel].modelParams.method = 'rejection'
      } else if ((blockClassNumber === 4) && (['deterministic', 'rejection', 'forward', 'enumerate'].includes(this.models[this.activeModel].modelParams.method))) {
        this.models[this.activeModel].modelParams.method = 'MCMC'
      }
    },
    cloneBlock (blockIndex) {
      const block = this.models[this.activeModel].blocks[blockIndex]
      const newBlock = JSON.parse(JSON.stringify(block))
      newBlock.id = 'b' + Math.round(Math.random() * 100000000)
      if ('name' in newBlock) {
        const nameArr = newBlock.name.split('')
        if (nameArr.length && !isNaN(nameArr[nameArr.length - 1])) {
          nameArr[nameArr.length - 1] = 1 + parseInt(nameArr[nameArr.length - 1])
        } else {
          nameArr.push(2)
        }
        newBlock.name = nameArr.join('')
      }
      this.models[this.activeModel].blocks.splice(blockIndex + 1, 0, newBlock)
    },
    removeBlock (blockIndex) {
      const typeCode = this.models[this.activeModel].blocks[blockIndex].typeCode
      this.models[this.activeModel].blocks.splice(blockIndex, 1)
    },
    toggleBlock (blockIndex) {
      const oldMinimized = this.models[this.activeModel].blocks[blockIndex].minimized
      this.models[this.activeModel].blocks[blockIndex].minimized = !oldMinimized
    },
    moveBlockToTop (blockIndex) {
      if (blockIndex > 0) {
        this.models[this.activeModel].blocks.splice(0, 0, this.models[this.activeModel].blocks.splice(blockIndex, 1)[0])
      }
    },
    moveBlockUp (blockIndex) {
      if (blockIndex > 0) {
        this.models[this.activeModel].blocks.splice(blockIndex - 1, 0, this.models[this.activeModel].blocks.splice(blockIndex, 1)[0])
      }
    },
    moveBlockDown (blockIndex) {
      if (blockIndex < this.models[this.activeModel].blocks.length - 1) {
        this.models[this.activeModel].blocks.splice(blockIndex + 1, 0, this.models[this.activeModel].blocks.splice(blockIndex, 1)[0])
      }
    },
  }
}
</script>