<style>
  .btn-menu {
    text-transform: none;
    font-weight: 500;
    font-size: 12px;
  }
</style>

<template>
  <v-system-bar
    color="white"
  >
    <v-menu
      v-for="(menuElements, menuName) in menuFunctions"
      :key="menuName"
      :class="'menu-' + menuName.toLowerCase()"
    >
      <template v-slot:activator="{ props }">
        <v-btn
          v-bind="props"
          density="compact"
          variant="text"
          class="btn-menu"
        >
          {{ menuName }}
        </v-btn>
      </template>
      <v-list>
        <v-list-item
          v-for="(element, elementIndex) in menuElements"
          :key="menuName + elementIndex"
          @click="$emit(element.method, ...element.args)"
          density="compact"
        >
          <v-list-item-title>{{ element.name }}</v-list-item-title>
        </v-list-item>
      </v-list>
    </v-menu>


    <v-spacer></v-spacer>
    StatSim {{ version }}
    <!-- <v-icon>mdi-square</v-icon> -->
    <!-- <v-icon>mdi-circle</v-icon> -->
    <!-- <v-icon>mdi-triangle</v-icon> -->
  </v-system-bar>
</template>

<script>
export default {
  name: 'Menu',
  data: () => {
    return {
      'menuFunctions': {
        'File': [
          {
            'name': 'New project', 
            'method': 'openDialog',
            'args': ['new-project-dialog']
          },
          {
            'name': 'Open project',
            'method': 'openFile',
            'args': ['Project']
          },
          {
            'name': 'Save As...',
            'method': 'saveProject',
            'args': []
          },
        ],
        'Edit': [
          {
            'name': 'Remove model',
            'method': 'removeModel',
            'args': []
          },
          {
            'name': 'Duplicate model',
            'method': 'duplicateModel',
            'args': []
          }
        ],
      }
      //
    }
  },
  methods: {
    //
  },
  props: ['version']
}
</script>