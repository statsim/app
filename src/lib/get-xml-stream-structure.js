const xmlNodes = require('xml-nodes')
const xmlObjects = require('xml-objects')
const flat = require('flat')

function getXmlStreamStructure(rs, cb) {
  var head = ''
  rs.on('readable', function() {
    if (head.length == 0) {
    //Pre-process XML
      var itemsReaded = 0
      var node = ''
      var item = ''
      var nodes = []
      var columns = []
      var saveNode = false
      var chunk = ''
      while ((itemsReaded < 10) && (null != (chunk = rs.read(1)))) {
        head += chunk
        //Adding node
        if ((saveNode) && ((chunk == '>') || (chunk == ' '))) {
          saveNode = false

          item = ''
          itemsReaded = 0
          nodes.push(node)

          for (var i = 0; i < nodes.length - 1; i++) {
            if ((nodes.indexOf(nodes[i],i+1) > 0) && (item.length == 0)) {
              item = nodes[i]
              itemsReaded = 2
              //console.log(nodes)
            }
            else if ((item.length > 0) && (nodes[i] == item)) {
              itemsReaded += 1
            }
          }
          //console.log(node,item,itemsReaded)
          node = ''
        }

        //End of node name
        if ((saveNode) && ((chunk == '/') || (chunk == '?'))) {
          saveNode = false
        }

        //Reading node name
        if ((saveNode) && (chunk != '/')) {
          node += chunk + ''
        }

        //Start of node
        if (chunk == '<') {
          saveNode = true
        }

      } //end of while
      if (item.length == 0) { item = nodes[0] }
      //console.log(item, head)
      var xmlPreParser = xmlNodes(item)
      xmlPreParser.write(head)
      xmlPreParser.push(null)
      xmlPreParser.pipe(xmlObjects({explicitRoot: false, explicitArray: false, mergeAttrs: true, ignoreAttrs: true}))
                  .on('data',function(obj){
                    // console.log(obj)
                    var arr = []
                    for (var prop in flat(obj)) {
                      arr.push(prop)
                    }
                    if (columns.length < arr.length) {
                      columns = arr.slice(0)
                    }
                  })
                  .on('end', function() {
                    rs.unshift(head)
                    cb(columns, item)
                  })
    } //end of if head
  })
}

module.exports = getXmlStreamStructure
