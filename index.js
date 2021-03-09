
const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn, execSync, spawnSync } = require('child_process')

const express = require('express')
const app = express()
const cors = require('cors')
const nocache = require('nocache')
const bodyParser = require('body-parser')

const { match, parse, exec } = require('matchit')
const validate = require('jsonschema').validate
const ua = require('ua-parser-js')

const session = require('express-session')
const cookieParser = require('cookie-parser')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy

const isLinux = process.platform != 'darwin' && process.platform != 'win32'
const isMac = process.platform == 'darwin'

let pamAuthenticate, pamErrors

if ( isLinux ) {
	pamAuthenticate = require('node-linux-pam').pamAuthenticate
	pamErrors = require('node-linux-pam').pamErrors
}

passport.use('login', new LocalStrategy( async (username, password, done) => {

	console.log('[api-auth] ⚡️  logging in with system auth:', username)
	try {
		const users = JSON.parse( await (await fs.readFileSync( path.resolve(__dirname, '../bin/users.json'))).toString() )
		const u = users.find( o => o.username == username )
		if (!u)  {
			const m = `no user with name "${username}" found`
			console.log('[api-auth] 👥 🛑  (A) error logging in:', m)
			return done(null, false, { message: m } )
		}

		let res = { code: 999, message: `not running pam (linux) or dscl (osx)` }
		if ( isLinux ) {
			res = await (new Promise( (resolve, reject) => {
				console.log(`[api-auth] 👥 ⚡️  authenticatiing "${username}" with pam...`)
				pamAuthenticate( { username, password }, function(err, code) {
					const message = Object.keys( pamErrors ).find(key => pamErrors[key] == code)
					if ( err ) reject({ message, code }) 
					else resolve({ message, code })
				})
			}))

		} else if (isMac) {

			try {
				res = { code: 0, message: await execSync( `dscl . -authonly ${username} "${password}"`  ) }
			} catch(err) {
				res = { code: 403, message: 'incorrect credentials' }
			}

		}

		if ( res.code != 0 ) {
			console.log('[api-auth] 👥 🛑  (C) error logging in:', res.message)
			return done(null, false, res.message )
		}
		
		console.log('[api-auth] 👥 ✅  success logging in:', username)
		return done(null, u)
	} catch(err) {
		console.log('[api-auth] 👥 ❌  (D) error logging in:', err.message)
		return done( null, false, err.message )
	}

}))


passport.serializeUser( async (u, done) => {
	console.log('[api-auth] ⚡️  serializing:', u.username)
	done(null, u.username)
})
 

passport.deserializeUser( async (username, done) => {
	try {

		const users = JSON.parse( await ( await fs.readFileSync( path.resolve(__dirname, '../bin/users.json') ) ).toString() )
		const u = users.find( uu => uu.username == username )
		// console.log('[api-auth] ✅  deserialized:', username)
		done(null, u)
	} catch( err ) {
		console.log('[api-auth] ❌  could not be deserialized:', err.message)
		done(null, null)
	}
	
})

function sendError( res, code, message, extra ) {
	res.status( code ).send( { message, code, status: code, error: true, ...extra } )
}

async function isAllowed (req, res, item, endpoints) {
	
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
		const apilist = endpoints.filter( a => a.type.toLowerCase() == method ).map( a => a.url ).map(parse)

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

const types = {

	// logger types

	API_ERR: '❌',
	API_TRY: '⚡️',
	API_SUCCESS: '✅',
	API_OPEN: '✨',
	API_STDOUT: '✉️',
	API_STDERR: '👺',
	API_CLOSE: '💨',

	// categories

	CAT_CORE: 'core',
	CAT_FILE: 'filesystem',
	CAT_AUTH: 'authentication',
	CAT_SYS: 'system',
	CAT_NET: 'network',
	CAT_PROC: 'processes',
	CAT_MEDIA: 'media',
	CAT_COMMS: 'communication',
	CAT_EXT: 'external',
	CAT_DB: 'database',
	CAT_SCRIPT: 'scripts'
}

module.exports = {
	types,
	app: ( _endpoints, _opts ) => {

		if ( !Array.isArray( _endpoints ) ) throw '[ezapi] first argument "endpoints" is not an array'
		if ( typeof(_opts) != 'object' && typeof(_opts) != 'undefined' ) throw '[ezapi] second argument "options" is not a object'

		const SECRET = require('crypto').randomBytes(64).toString('hex')

		const opts = {
			port: 3000,
			usersPath: './bin/users.json',
			apiPath: '/api',
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
			nocache: false,
			...(_opts||{})
		}

		if (!opts.session.secret) opts.session.secret = SECRET

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
				url: opts.apiPath,
				next: express.static( path.join(__dirname, 'assets') ),
				description: 'serves static assets including svelte build',
				category: types.CAT_CORE
			},	
			{
				url: '/logout',
				type: 'post',
				description: 'log out of api',
				category: types.CAT_AUTH,
				schema: {},
				emoji: '🔑',
				next: async (req, res, data) => {
					await req.logout()
					res.send( `logged out` )
				}
			},
			{
				url: '/login',
				type: 'post',
				description: 'login with username and password',
				category: types.CAT_AUTH,
				schema: {},
				emoji: '🔑',
				next: (req,res,next) => { 
					passport.authenticate('login', function( err, user, info ) {
						if (!user || err) return res.status(404).send( info )
						req.logIn( user, function(error) {
							if (error) return res.status( 500 ).send( error )
							return res.send( user )
						})
					})( req, res, next)
				}
			},
			{
				url: '/whoami',
				type: 'get',
				description: 'view current user',
				category: types.CAT_AUTH,
				schema: {},
				emoji: '🔒',
				data: async e => null,
				next: async (req, res, data) => {

					res.send( req.user )
				}
			},
			{
				url: '/check_auth',
				type: 'get',
				description: 'check permissions for endpoint',
				category: types.CAT_AUTH,
				schema: {
					path: {
						type: 'string',
						required: true
					}
				},
				emoji: '🔒',
				data: async e => null,
				next: async (req, res, data) => {

					res.send( req.user )
				}
			},
			..._endpoints, // <--- endpoints
			{
				url: '/endpoints',
				type: 'get',
				schema: {},
				data: async (params, user) => {
					return endpoints.map( a => {
						let { next, data, ...b } = a
						if (b.type != 'use') b.url = path.join( opts.apiPath, b.url )
						return b
					})
				},
				description: 'show list of API endpoints',
				category: types.CAT_CORE
			},
			{
				url: '/*',
				type: 'get',
				next: async (req, res, next) => {
					const similarity = require('similarity')
					const match = endpoints.map( o => { return {
						similarity: similarity( req.path, o.url ),
						name: o.url,
						type: o.type
					}}).sort( (a,b) => b.similarity - a.similarity )[0]
					res.status(404).send( { 
						message: `no such endpoint ${req.method.toUpperCase()} ${req.path}, did you mean ${match.type.toUpperCase()} ${path.join( opts.apiPath, match.name )}?`, 
						code: 404 })
				},
				description: 'return error message if not found',
				category: types.CAT_CORE
			}
		]

		if (opts.nocache) app.use(nocache())

		endpoints.forEach( item => {

			const emoji = item.type == 'use' ? '🔧' : item.type == 'get' ? '🍬' : '✉️'
			console.log(`[api] ${emoji}  ${item.type.toUpperCase()}: ${item.url || '~'} ${ item.type == 'use' ? item.description : ''}`)
			if (item.type == 'use') {
				if (item.url)
					app[ item.type ]( item.url, item.next )
				else
					app[ item.type ]( item.next )
			} else {
				app[ item.type ]( path.join( opts.apiPath, item.url ), async (req, res) => {
					try {

						let ipV4 = req.connection.remoteAddress.replace(/^.*:/, '')
						if (ipV4 === '1') ipV4 = 'localhost'
						console.log(`[api] 🐟  incoming request from "${ipV4}"...`) 

						// const info = (new ua()).setUA( req.headers['user-agent'] ).getResult()
						// console.log(info)

						// authorise endpoint
						const regex = await isAllowed(req, res, item, endpoints)

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
						inform( req.path, types.API_ERR, err.message || err )
						return sendError( res, err.code || 500, err.message || err )
						
					}
				})
			}
		})


		const server = app.listen( opts.port , async () => {

			const template = [
			    {
			        "username": "guest",
			        "allows": "get",
			        "disallows": "post,delete,push"
			    }
			]

			const dest = path.resolve(__dirname, './bin/users.json')
			try {
				const exists = await fs.existsSync( dest )
				if (!exists) {
					await fs.writeFileSync( dest, JSON.stringify( template ) )
					console.log(`[api] ✅  success copying ${src} -> ${dest}` )
				}
			} catch(err) {
				console.log(`[api] ❌  error copying ${src} -> ${dest}: "${err.message}"` )
			}
			const port = server.address().port
			console.log(`[api] ✨  server running on port: ${port}`)
		})

		return server
	}
}

