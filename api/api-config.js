const types = require('./types.js')
const session = require('express-session')
const bodyParser = require('body-parser')
const os = require('os')
const path = require('path')
const express = require('express')
const api = require('./api-auth.js')
.concat( require('./api-file.js') )
.concat( require('./api-media.js') )
.concat( require('./api-net.js') )
.concat( require('./api-proc.js') )
.concat( require('./api-sys.js') )


module.exports = [

	// ----------- CAT_CONF -----------

	{
		type: 'use',
		url: 'bodyParser JSON',
		method: bodyParser.json(),
		description: 'parses JSON requests',
		category: types.CAT_CONF
	},
	{
		type: 'use',
		url: 'bodyParser URL encoded', 
		method: bodyParser.urlencoded({ extended: false }),
		description: 'parses url parameters',
		category: types.CAT_CONF
	},
	{
		type: 'use',
		url: 'session secret',
		method: session({ 
			secret: 'some-secret',
			saveUninitialized: false,
			resave: true
		}),
		description: 'authentication secret',
		category: types.CAT_CONF
	},

	{
		type: 'use',
		url: 'express static (assets)',
		method: express.static('assets', {etag: false, maxAge: '5000'}),
		description: 'serves static assets',
		category: types.CAT_CONF
	},	

	{
		url: '/endpoints',
		type: 'get',
		method: async function(req, res) {
			res.send( api.map( a => {
				let { method, ...b } = a
				return b
			} ) )
		},
		returns: 'json',
		description: 'show list of API endpoints	',
		category: types.CAT_CONF
	}

	// ------------------------ default page ------------------------

	// {
	// 	url: '/',
	// 	type: 'get',
	// 	description: 'api summary',
	// 	schema: {},
	// 	returns: 'html',
	// 	category: types.CAT_CONF,
	// 	method: function(req, res) {
	// 		res.sendFile(path.resolve(__dirname, '../assets', 'index.html'))
	// 		// let str = (req.user) ? `
	// 		// 	<p>You\'re logged in as <strong>${req.user.username} </strong> <a href="/logout">Log out</a></p>'
	// 		// ` : `
	// 		// 	<p><a href="/login">Login</a></p>
	// 		// `
	// 		// api.forEach( item => {
	// 		// 	str += item.type == 'use' ? `
	// 		// 	<p>${item.type}: ${item.description}</p>
	// 		// 	` : `
	// 		// 	<p><strong>${item.category}\t</strong><a href="${item.url}">${item.url} (${item.type})</a>: ${item.description}</p>
	// 		// 	`
	// 		// })

	// 		// str += `

	// 		// 	<div id="sockets">
	// 		// 		<div><strong>websockets</strong></div>
	// 		// 	</div>


	// 		// 	<script>

	// 		// 		console.log('[overview.svelte] 👁 ⚡️  opening websocket...')
	// 		// 		// const ws = new WebSocket( "ws://${os.hostname()}.local:8765" )
	// 		// 		const ws = new WebSocket( "ws://localhost:8765" )
	// 		// 		ws.addEventListener('open', () => console.log('websocket opened') )
	// 		// 		ws.addEventListener('message', (e) => {
	// 		// 			console.log('websocket message', e.data)
	// 		// 			const j = JSON.parse(e.data)
	// 		// 			const d = document.getElementById( 'sockets' ) 
	// 		// 			const n = document.createElement("div")
	// 		// 			const t = document.createTextNode( '[' + j.pid + '] ' + j.type + ' : ' + j.message ) 
	// 		// 			n.appendChild( t )
	// 		// 			d.appendChild( n )
	// 		// 		})
	// 		// 		ws.addEventListener('error', (e) => console.log('websocket error', e) )
	// 		// 		ws.addEventListener('close', (e) => console.log('websocket closed', e) )
	// 		// 	</script>
	// 		// `

	// 		// str += style

	// 		// res.send( str )

	// 	}
	// }
]