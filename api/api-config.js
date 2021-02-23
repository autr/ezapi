const types = require('../types.js')
const session = require('express-session')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const os = require('os')
const path = require('path')
const express = require('express')
const passport = require('passport')
const flash = require('connect-flash')
const cors = require('cors')

const SECRET = require('crypto').randomBytes(64).toString('hex')

module.exports = [

	// ----------- CAT_CONF -----------

	{
		type: 'use',
		next: cookieParser( SECRET ),
		description: 'parses cookies for auth',
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
		next: bodyParser.json(),
		description: 'parses JSON requests',
		category: types.CAT_CONF
	},
	{
		type: 'use',
		next: session({ 
			secret: SECRET,
			resave: true,
			saveUninitialized: true,
			cookie: {
				httpOnly: true,
				maxAge: 60*60*1000
			}
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
		next: cors({
			exposedHeaders: ['set-cookie'],
			credentials: true, 
			origin: 'http://localhost:5000'
		}),
		description: 'CORS origin policy',
		category: types.CAT_CONF
	},
	{
		type: 'use',
		next: express.static('assets', {etag: false, maxAge: '5000'}),
		description: 'serves static assets',
		category: types.CAT_CONF
	}
]