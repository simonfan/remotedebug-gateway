var deepPluck = require('deep-pluck')
var logger = require('../logger')
var Promise = require('es6-promise').Promise
var debug = require('debug')('plugin:node-mapping')

Array.prototype.insert = function (index, items) {
  Array.prototype.splice.apply(this, [index, 0].concat(items))
}

function NodeIdsPlugin () {
  var getDocumentIndex = {}
  var masterSocketUrl
  var nodeIndex = {}

  this.onRequest = function (msg, target, connection, socket) {

    return new Promise(function (resolve, reject) {

      if (target.connections.indexOf(socket) === 0) {
        masterSocketUrl = socket.url
      }

      if (msg.method && msg.method === 'DOM.getDocument') {
        getDocumentIndex[socket.url] = msg.id
      }

      // Re-write node-ids for all other sockets than the master connectionHI
      if (target.connections.indexOf(socket) > 0) {
        if (msg.params && msg.params.nodeId) {
          debug('plugin.node-mapping.intercepter.rewrite.nodeID', msg.params.nodeId)
          if (nodeIndex && nodeIndex[socket.url]) {

            var index = nodeIndex[masterSocketUrl].indexOf(msg.params.nodeId)
            debug('plugin.node-mapping.rewrite.nodeIndex', index)
            var mappedNodeId = nodeIndex[socket.url][index]

            if (mappedNodeId) {
              debug('plugin.node-mapping.ewrite.nodeID.overridden', msg.params.nodeId, mappedNodeId)
              msg.params.nodeId = mappedNodeId
            }
          }
        }
      }

      resolve(msg)
    })
  },

  this.onResponse = function (msg, target, connection, socket) {
    return new Promise(function (resolve, reject) {
      if (msg.id === getDocumentIndex[socket.url]) {
        nodeIndex[socket.url] = deepPluck(msg.result, 'nodeId')
        debug('plugin.node-mapping.DOM.getDocument.index.updated', nodeIndex[socket.url])
      }

      if (msg.method === 'DOM.setChildNodes') {
        var nodeId = msg.params.parentId
        var index = nodeIndex[socket.url]

        if (index) {
          var nodeIndexPosition = index.indexOf(nodeId) + 1
          var newNodeIds = deepPluck(msg.params.nodes, 'nodeId')
          // Insert at nodeIndexPosition
          index.insert(nodeIndexPosition, newNodeIds)
          debug('plugin.node-mapping.DOM.setChildNode.index.updated', index)
        }
      }
      resolve(msg)
    })
  }

}

module.exports = new NodeIdsPlugin()
