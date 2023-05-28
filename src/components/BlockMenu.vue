<template>
    <!-- `open-on-hover` make it unresponsive on mobile -->
    <v-menu>
      <template v-slot:activator="{ props }">
        <v-btn
          v-bind="props"
          icon
        >
          <v-icon>mdi-plus</v-icon>
        </v-btn>
      </template>
      <v-list>
        <v-list-item
          v-for="(item, index) in items"
          :key="item.code"
          :value="item.code"
        >
          <v-btn @click="addBlock(item.code)" block plain> {{ item.name }}</v-btn>
          <!-- 
            <v-list-item-title @click="addBlock(item.code)">{{ item.name }}</v-list-item-title>
          -->
        </v-list-item>
      </v-list>
    </v-menu>
</template>

<script>

export default {

  props: ['items'],
  methods: {
    addBlock: function (typeCode) {
      this.$emit('addBlock', typeCode)
    }
  }
}
</script>