const types = require('../types.js')
const session = require('express-session')
const bodyParser = require('body-parser')
const os = require('os')
const path = require('path')
const express = require('express')
const passport = require('passport')
const flash = require('connect-flash')
const cors = require('cors')

module.exports = [

	// ----------- CAT_CONF -----------

	{
		type: 'use',
		next: cors(),
		description: 'CORS origin policy',
		category: types.CAT_CONF
	},
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
			secret: require('crypto').randomBytes(64).toString('hex'),
			saveUninitialized: false,
			resave: false
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
	}
]