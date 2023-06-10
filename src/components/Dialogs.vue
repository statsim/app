<template>
  <div>
    <!-- Dialog: New project -->
    <v-dialog
      v-model="dialogs['new-project-dialog']"
      width="800"
    >
      <v-card>
        <v-card-title>
          <span class="text-h5">New project</span>
        </v-card-title>
        <v-card-text>
          Creating a new project will erase all current models and data. Click <b>New Project</b> to initiate a fresh project and delete all present assets.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="grey-darken-1"
            variant="text"
            @click="emit(null)"
          >
            Cancel
          </v-btn>
          <v-btn
            color="green-darken-1"
            variant="text"
            @click="emit('newProject')"
          >
            New project
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog
      v-model="dialogs['remove-model-dialog']"
      width="800"
    >
      <v-card>
        <v-card-title>
          <span class="text-h5">Remove model</span>
        </v-card-title>
        <v-card-text>
          Creating a new project will erase all current models and data. Click <b>New Project</b> to initiate a fresh project and delete all present assets.
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn
            color="grey-darken-1"
            variant="text"
            @click="emit(null)"
          >
            Cancel
          </v-btn>
          <v-btn
            color="red-darken-1"
            variant="text"
            @click="emit('removeModelConfirmed', 'ok')"
          >
            Remove model
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script>
  export default {
    methods: {
      emit(method, ...args) {
        // Close all dialogs
        Object.keys(this.dialogs).forEach(key => {
          this.dialogs[key] = false
        })
        // Emit method
        if (method) {
          this.$emit(method, ...args)
        } 
      }
    },
    props: ['dialogs']
  }
</script>