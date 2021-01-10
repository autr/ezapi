const types = require('../types.js')
const session = require('express-session')
const bodyParser = require('body-parser')
const os = require('os')
const path = require('path')
const express = require('express')
const passport = require('passport')
const flash = require('connect-flash')
const api = require('./api-auth.js')
.concat( require('./api-file.js') )
.concat( require('./api-media.js') )
.concat( require('./api-net.js') )
.concat( require('./api-proc.js') )
.concat( require('./api-sys.js') )
.concat( require('./api-comms.js') )
.concat( require('./api-cloud.js') )
.concat( require('./api-ext.js') )


module.exports = [

	// ----------- CAT_CONF -----------

	{
		type: 'use',
		next: bodyParser.json(),
		description: 'parses JSON requests',
		category: types.CAT_CONF
	},
	{
		type: 'use',
		next: bodyParser.urlencoded({ extended: true }),
		description: 'parsing url parameters',
		category: types.CAT_CONF
	},
	{
		type: 'use',
		next: session({ 
			secret: 'some-secret',
			saveUninitialized: false,
			resave: true
		}),
		description: 'authentication secret',
		category: types.CAT_CONF
	},
	{
		type: 'use',
		next: passport.initialize(),
		description: 'auth initialize',
		category: types.CAT_AUTH
	},
	{
		type: 'use',
		next: passport.session(),
		description: 'auth session',
		category: types.CAT_AUTH
	},
	{
		type: 'use',
		next: flash(),
		description: 'storing log errors with flash()',
		category: types.CAT_AUTH
	},

	{
		type: 'use',
		next: express.static('assets', {etag: false, maxAge: '5000'}),
		description: 'serves static assets',
		category: types.CAT_CONF
	},	

	{
		url: '/endpoints',
		type: 'get',
		schema: {},
		data: async (params, user) => {
			const endpoints = api.map( a => {
				let { method, ...b } = a
				return b
			})
			return endpoints
		},
		description: 'show list of API endpoints',
		category: types.CAT_CONF
	}
]