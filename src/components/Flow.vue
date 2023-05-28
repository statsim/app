<template>
    <!--
        By default, the editor completely fills its parent HTML element.
        If you directly use the editor in the <body> element, make sure to use
        a wrapper <div> with specified width and height properties:
        <div style="width: 90vw; height: 90vh">
            <baklava-editor :view-model="baklava" />
        </div>
    -->
    <baklava-editor :view-model="baklava" />
</template>

<script>
  import { defineComponent } from "vue";
  import { defineNode, NodeInterface, NumberInterface, SelectInterface } from "baklavajs";
  import { EditorComponent, useBaklava } from "@baklavajs/renderer-vue";
  import "@baklavajs/themes/dist/syrup-dark.css";
  
  // Define a custom node
  const Node = defineNode({
      type: "MyNode",
      inputs: {
          number1: () => new NumberInterface("Number", 1),
          number2: () => new NumberInterface("Number", 10),
          operation: () => new SelectInterface("Operation", "Add", ["Add", "Subtract"]).setPort(false),
      },
      outputs: {
          output: () => new NodeInterface("Output", 0),
      },
  })

  export default defineComponent({
    components: {
      "baklava-editor": EditorComponent,
    },
    setup() {
      const baklava = useBaklava();
      baklava.editor.registerNodeType(Node);
      return { baklava };
    },
  });
</script>
