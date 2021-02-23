const WebSocket = require('ws')
const http = require('http')
const types = require('./types.js')

const wss = new WebSocket.Server({ port: 9876 })

const inform = ( pid, type, message, extra ) => {
	const msg = typeof( message ) == 'object' || typeof( message ) == 'array' ? JSON.stringify( message ) : message
	console.log(`[inform] ${type}  🌐  ${pid}: "${msg}"`, extra || '')
	wss.clients.forEach(function each(client) {
	  if (client.readyState === WebSocket.OPEN) {
	    client.send( JSON.stringify( { pid, type, msg } ) )
	  }
	})
}
let spawned = []

wss.on('connection', function connection(ws) {

	const addr = ws._socket.address()
	console.log(`[websockets] 🌐 ✅  connection made: ${addr.address} ${addr.port}"`)

	ws.on('message', function incoming(message) {
		console.log('received: %s', message)
	})

	inform( 0, types.API_SUCCESS, 'connected to client')
})


module.exports = { wss, inform }