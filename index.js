const express = require('express')
const app = express()
const fs = require('fs')
const { inform } = require( './websockets.js' )
const { API_ERR, API_TRY, API_SUCCESS, API_OPEN, API_STDOUT, API_STDERR, API_CLOSE } = require('./types.js')
const { match, parse, exec } = require('matchit')
const validate = require('jsonschema').validate
const ua = require('ua-parser-js')
const types = require('./types.js')
const session = require('express-session')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const os = require('os')
const path = require('path')
const passport = require('passport')
const flash = require('connect-flash')
const cors = require('cors')

function sendError( res, code, message, extra ) {
	res.status( code ).send( { message, code, status: code, error: true, ...extra } )
}

async function isAllowed (req, res, item) {
	
	let user = req.user
	let isAuth = req.isAuthenticated()

	if (!req.isAuthenticated()) {
		const users = JSON.parse( await ( await fs.readFileSync( path.resolve(__dirname, './bin/users.json') ) ).toString() )
		user = users.filter( u => u.username == 'guest' )[0]
		req.user = user
		if (user) isAuth = true
	}
	const c = '\x1b[93m'
	const e = '\033[0m'
	console.log(`${c}[api] 👤  ${req.method} ${req.path} -> ${req.user.username} ${e}`)
	if ( user && isAuth ) {

		const method = req.method.toLowerCase()

		const whitelist = !user.allows[ method ] ? [] : user.allows[ method ].split(',').map( u => u.trim() ).map( parse )
		const apilist = items.list.filter( a => a.type.toLowerCase() == method ).map( a => a.url ).map(parse)

		const foundA = match(req.path, whitelist)
		const foundB = match(req.path, apilist)
		if (foundA.length > 0 && foundB.length > 0) {

			// now we must match against the real endpoints (not shorthand)...
			
			const params = exec(req.path, foundB)
			return params
		}
	}
	return false 
}

module.exports = ( _endpoints, _opts ) => {

	if ( !Array.isArray( _endpoints ) ) throw '[ezapi] first argument "endpoints" is not an array'
	if ( typeof(_opts) != 'object' && typeof(_opts) != 'undefined' ) throw '[ezapi] second argument "options" is not a object'

	const SECRET = require('crypto').randomBytes(64).toString('hex')

	const opts = {
		port: 3000,
		usersPath: './bin/users.json',
		session: { 
			secret: SECRET,
			resave: true,
			saveUninitialized: true,
			cookie: {
				httpOnly: true,
				maxAge: 60*60*1000
			}
		},
		cors: {
			exposedHeaders: ['set-cookie'],
			credentials: true, 
			origin: 'http://localhost:5000'
		},
		...(_opts||{})
	}

	if (!opts.session.secret) opts.session.secret = SECRET


	// const _items = []
	// .concat( require('./api/api-auth.js') )
	// .concat( require('./api/api-file.js') )
	// .concat( require('./api/api-media.js') )
	// .concat( require('./api/api-net.js') )
	// .concat( require('./api/api-proc.js') )
	// .concat( require('./api/api-sys.js') )
	// .concat( require('./api/api-comms.js') )
	// .concat( require('./api/api-ext.js') )
	// .concat( require('./modules/dataaa-api/index.js').endpoints )


	const endpoints = [

		{
			type: 'use',
			next: cookieParser( opts.session.secret ),
			description: 'parses cookies for auth',
			category: types.CAT_CORE
		},
		{
			type: 'use',
			next: bodyParser.urlencoded({ extended: true }),
			description: 'parsing url parameters',
			category: types.CAT_CORE
		},
		{
			type: 'use',
			next: bodyParser.json(),
			description: 'parses JSON requests',
			category: types.CAT_CORE
		},
		{
			type: 'use',
			next: session( opts.session ),
			description: 'authentication secret',
			category: types.CAT_CORE
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
			next: cors(opts.cors),
			description: 'CORS origin policy',
			category: types.CAT_CORE
		},
		{
			type: 'use', // this serves Svelte overview
			next: express.static('assets', { etag: false, maxAge: '5000' } ),
			description: 'serves static assets including svelte build',
			category: types.CAT_CORE
		},
		..._endpoints, // <--- endpoints
		{
			url: '/endpoints',
			type: 'get',
			schema: {},
			data: async (params, user) => {
				const endpoints = items.map( a => {
					let { method, ...b } = a
					return b
				})
				return endpoints
			},
			description: 'show list of API endpoints',
			category: types.CAT_CORE
		},
		{
			url: '/package',
			type: 'get',
			schema: {},
			data: async (params, user) => {
				return JSON.parse( await ( await (require('fs')).readFileSync('./package.json') ).toString() )
			},
			description: 'view package.json',
			category: types.CAT_CORE
		},
		{
			url: '/*',
			type: 'get',
			next: async (req, res, next) => {
				const similarity = require('similarity')
				const match = items.map( o => { return {
					similarity: similarity( req.path, o.url ),
					name: o.url
				}}).sort( (a,b) => b.similarity - a.similarity )[0]
				res.status(404).send( { message: `no such endpoint ${req.path}, did you mean ${match.name}?`, code: 404 })
			},
			description: 'return error message',
			category: types.CAT_CORE
		}
	]

	endpoints.forEach( item => {

		const emoji = item.type == 'use' ? '🔧' : item.type == 'get' ? '🍬' : '✉️'
		console.log(`[api] ${emoji}  ${item.type.toUpperCase()}: ${item.url || '~'} ${ item.type == 'use' ? item.description : ''}`)
		if (item.type == 'use') {
			app[ item.type ]( item.next )
		} else {
			app[ item.type ]( item.url, async (req, res) => {
				try {

					let ipV4 = req.connection.remoteAddress.replace(/^.*:/, '')
					if (ipV4 === '1') ipV4 = 'localhost'
					console.log(`[api] 🐟  incoming request from "${ipV4}"...`)

					// const info = (new ua()).setUA( req.headers['user-agent'] ).getResult()
					// console.log(info)

					// authorise endpoint
					const regex = await isAllowed(req, res, item)

					if (!regex) {
						console.log(`[api] 🛑  "${req?.user?.username}" not authorised: allows="${req?.user?.allows || '~'}" -> ${item.type} ${item.url}` )
						return sendError( res, 401, 'not authorised')
					}

					const user = {}
					const args = ( item.type.toLowerCase() == 'get' ) ? req.query : req.body

					// check schema

					const schema = {
						type: 'object',
						properties: item.schema
					}

					const result = validate( args, schema, {required: true} )

					if (!result.valid) {
						const errs = result.errors.map( e => e.stack.trim() ).join(', ').replaceAll('instance.', '')
						console.log(`[api] 🛑  ${req.method} ${req.path} invalid schema "${errs}" -> ${item.type} ${item.url}`, args )
						console.log( '--------------\n', args, '--------------\n')
						console.log( '--------------\n', schema, '--------------\n')
						return sendError( res, 422, errs, { args } )
					}

					// process data

					const data = (item.data) ? await item.data( { ...args, regex }, user ) : {}

					// perform res and req

					const colors = {
						get: '\x1b[92m',
						post: '\x1b[96m',
						delete: '\x1b[95m'
					}
					const c = colors[req.method.toLowerCase()]
					const e = '\033[0m'
					console.log(`${c}[api] ✅  ${req.method} ${req.path} -> success! ${e}`)
					const send = item.next || ( (req, res, data) => res.send( data ) )
					return send( req, res, data )
					
				} catch(err) {

					console.log(`[api] 🚨  ${req.method} ${req.path} caught error `, err.message || err, err.stack || err )
					inform( req.path, API_ERR, err.message || err )
					return sendError( res, err.code || 500, err.message || err )
					
				}
			})
		}
	})


	return app.listen(3000, async () => {

		console.log('LOCATIONS:', __dirname, __filename)

		const dest = path.resolve(__dirname, './bin/users.json')
		const src = path.resolve(__dirname, './api/users.template.json')
		try {
			const exists = await fs.existsSync( dest )
			if (!exists) {
				const copy = await fs.copyFileSync( src, dest )
				console.log(`[api] ✅  success copying ${src} -> ${dest}` )
			}
		} catch(err) {
			console.log(`[api] ❌  error copying ${src} -> ${dest}: "${err.message}"` )
		}
		const port = server.address().port
		console.log(`[api] ✨  server running on port: ${port}`)
	})
}

