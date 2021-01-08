const types = require('../types.js')
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
		data: bodyParser.json(),
		description: 'parses JSON requests',
		category: types.CAT_CONF
	},
	{
		type: 'use',
		data: bodyParser.urlencoded({ extended: false }),
		description: 'parses url parameters',
		category: types.CAT_CONF
	},
	{
		type: 'use',
		data: session({ 
			secret: 'some-secret',
			saveUninitialized: false,
			resave: true
		}),
		description: 'authentication secret',
		category: types.CAT_CONF
	},

	{
		type: 'use',
		data: express.static('assets', {etag: false, maxAge: '5000'}),
		description: 'serves static assets',
		category: types.CAT_CONF
	},	

	{
		url: '/endpoints',
		type: 'get',
		schema: {},
		data: async params => api.map( a => {
				let { method, ...b } = a
				return b
		}),
		description: 'show list of API endpoints',
		category: types.CAT_CONF
	}
]