
const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn, execSync, spawnSync } = require('child_process')

const express = require('express')
const app = express()
const nocache = require('nocache')

const { match, parse, exec } = require('matchit')
const validate = require('jsonschema').validate
const ua = require('ua-parser-js')

const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy

const isLinux = process.platform != 'darwin' && process.platform != 'win32'
const isMac = process.platform == 'darwin'

let pamAuthenticate, pamErrors

if ( isLinux ) {
	pamAuthenticate = require('node-linux-pam').pamAuthenticate
	pamErrors = require('node-linux-pam').pamErrors
}

const types = require( './src/types.js' )
const endpointsPre = require( './src/endpoints-pre.js' )
const endpointsPost = require( './src/endpoints-post.js' )

const usersPath = opts => {
	return path.resolve(__dirname, './bin/users.json')
}

const readUsersFile = async opts => {
	const buff = await fs.readFileSync( usersPath( opts )  )
	const str = await buff.toString()
	return JSON.parse( str )
}


function sendError( res, code, message, extra ) {
	res.status( code ).send( { message, code, status: code, error: true, ...extra } )
}

async function isAllowed (req, res, item, endpoints, opts) {
	
	const c = '\x1b[93m'
	const e = '\033[0m'


	let user = req.user
	let isAuth = req.isAuthenticated()
	console.log(`${c}[api] 👤  ${usersPath()}${e} ---->`, user)

	if (!req.isAuthenticated()) {
		const users = await readUsersFile( opts )
		user = users.filter( u => u.username == 'guest' )[0]
		req.user = user
		if (user) isAuth = true
	}

	console.log(`${c}[api] 👤  ${req.method} ${req.user.username} -> ${req.path} ${e}`)
	if ( user && isAuth ) {

		const method = req.method.toLowerCase()

		let cleanPath = req.path
		if (cleanPath.substring(0,opts.apiRoot.length) == opts.apiRoot) {
			cleanPath = cleanPath.substring(opts.apiRoot.length)
		}

		const whitelist = !user.allows[ method ] ? [] : user.allows[ method ].split(',').map( u => u.trim() ).map( parse )
		const apilist = endpoints.filter( a => a.type.toLowerCase() == method ).map( a => a.url ).map(parse)
		const foundA = match(cleanPath, whitelist)
		const foundB = match(cleanPath, apilist)

		if (foundA.length > 0 && foundB.length > 0) {

			// now we must match against the real endpoints (not shorthand)...
			
			const params = exec(cleanPath, foundB)
			return params
		}
	}
	return false 
}


const passportConfig = {
	strategy: async (username, password, done) => {

		console.log('[api-auth] ⚡️  logging in with system auth:', username)
		try {
			const users = await readUsersFile( opts )
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

	},
	serialize: async (u, done) => {
		console.log('[api-auth] ⚡️  serializing:', u.username)
		done(null, u.username)
	},
	deserialize: async (username, done) => {
		try {

			const users = await readUsersFile( opts )
			const u = users.find( uu => uu.username == username )
			// console.log('[api-auth] ✅  deserialized:', username)
			done(null, u)
		} catch( err ) {
			console.log('[api-auth] ❌  could not be deserialized:', err.message)
			done(null, null)
		}
		
	}
}

module.exports = {
	types,
	app: ( _endpoints, _opts, _auth ) => {


		if ( !Array.isArray( _endpoints ) ) throw '[ezapi] first argument "endpoints" is not an array'
		if ( typeof(_opts) != 'object' && typeof(_opts) != 'undefined' ) throw '[ezapi] second argument "options" is not a object'

		const SECRET = require('crypto').randomBytes(64).toString('hex')

		const opts = {
			port: 3000,
			usersPath: './bin/users.json',
			logPath: './bin/log.txt',
			apiRoot: '/api',
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

		const auth = { ...passportConfig, ...(_auth || {}) }

		passport.use('login', new LocalStrategy( auth.strategy ) )
		passport.serializeUser( auth.serialize )
		passport.deserializeUser( auth.deserialize )

		if (!opts.session.secret) opts.session.secret = SECRET

		const endpoints = [
			...endpointsPre( opts, _endpoints ),
			..._endpoints, // <--- endpoints
			...endpointsPost( opts, _endpoints )
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
				app[ item.type ]( path.join( opts.apiRoot, item.url ), async (req, res) => {
					try {

						let ipV4 = req.connection.remoteAddress.replace(/^.*:/, '')
						if (ipV4 === '1') ipV4 = 'localhost'
						console.log(`[api] 🐟  incoming request from "${ipV4}"...`) 

						// const info = (new ua()).setUA( req.headers['user-agent'] ).getResult()


						const regex = await isAllowed(req, res, item, endpoints, opts)

						if (!regex) {
							console.log(`[api] 🛑  "${req?.user?.username}" not authorised: allows="${JSON.stringify(req?.user?.allows) || '~'}" -> ${item.type} ${item.url}` )
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
							const errs = result.errors.map( err => { 
								return err.path[err.path.length-1] + ' ' + err.message
							}).join('\n')

							console.log(`[api] 🛑  ${req.method} ${req.path} invalid schema "${errs}" -> ${item.type} ${item.url}` )
							const extra = { args, schema, result } 
							return sendError( res, 422, errs, extra)
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
						// inform( req.path, types.API_ERR, err.message || err )
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

			const dir = './bin'
			const dest = usersPath( opts)


			try {
				if (!fs.existsSync(dir))  fs.mkdirSync(dir)
				const exists = await fs.existsSync( dest )
				if (!exists) {
					await fs.writeFileSync( dest, JSON.stringify( template ) )
					console.log(`[api] ✅  success creating -> ${dest}` )
				}
			} catch(err) {
				console.log(`[api] ❌  error creating -> ${dest}: "${err.message}"` )
			}
			const port = server.address().port
			console.log(`[api] ✨  server running on port: ${port}`)
		})

		return server
	}
}

