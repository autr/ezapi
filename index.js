
const fs = require('fs')
const crypto = require('crypto')
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

const types = require( './src/types.js' )
const endpointsPre = require( './src/endpoints-pre.js' )
const endpointsPost = require( './src/endpoints-post.js' )


module.exports = {
	types,
	app: ( _endpoints, _opts, _auth ) => {


		if ( !Array.isArray( _endpoints ) ) throw '[ezapi] first argument "endpoints" is not an array'
		if ( typeof(_opts) != 'object' && typeof(_opts) != 'undefined' ) throw '[ezapi] second argument "options" is not a object'

		const SECRET = require('crypto').randomBytes(64).toString('hex')

		const opts = {
			port: 3000,
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

		console.log(`[ezapi]  using port ${opts.port}`)

		const auth = { 
			strategy: async ( username, password, done ) => {
				console.log(`[ezapi]  strategy ${username} p**sw**d`)

				const token = await crypto.scryptSync( password, process.env.EZAPI_KEY, 64).toString('hex')
				const hasAdmin = username == 'admin' || ( username == process.env.EZAPI_ADMIN && username )
				const hasPassword = (token == process.env.EZAPI_PASSWORD) && password

				if ( hasAdmin && hasPassword ) {
					done( null, { username: 'admin' } )
				} else {
					done( null, false, 'incorrect password')
				}
			},
			serialize: async (u, done) => {
				console.log(`[ezapi]  deserialise ${u?.username}`)
				done(null, u.username)
			},
			deserialize: async (username, done) => {
				console.log(`[ezapi]  deserialise ${username}`)
				if (username == 'admin') {
					done( null, { username: 'admin' } ) 
				} else {
					done(null, null)
				}
			},
			permissions: async user => (user?.username == 'admin' ?
				{
					get: '/*',
					post: '/*',
					put: '/*',
					delete: '/*'
				} : {
					get: '/*',
					post: '/login',
					put: null,
					delete: null
				}
			),
			...(_auth || {}) 
		}

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


		const sendError = ( res, code, message, extra ) => {
			const json = { message, code, status: code, error: true, ...extra }
			res.status( code ).send( json )
		}

		endpoints.forEach( item => {

			const emoji = item.type == 'use' ? '🔧' : item.type == 'get' ? '🍬' : '✉️'
			if (!opts.silent) console.log(`[api] ${emoji}  ${item.type.toUpperCase()}: ${item.url || '~'} ${ item.type == 'use' ? item.description : ''}`)
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
						if (!opts.silent) console.log(`[api] 🐟  incoming request from "${ipV4}"...`) 

						// const info = (new ua()).setUA( req.headers['user-agent'] ).getResult()

						// ----------------------------------------
						// isAllowed ->
						// ----------------------------------------

						let regex = null
						let user = req.isAuthenticated() ? req.user : 'guest'
						if (!opts.silent) console.log(`[api] 👤  ${req.method} ${user} -> ${req.path}`)

						const method = req.method.toLowerCase()

						let cpath = req.path
						if (cpath.substring(0,opts.apiRoot.length) == opts.apiRoot) {
							// clean path
							cpath = cpath.substring(opts.apiRoot.length)
						}
						const permissions = ( await auth.permissions( user ) || {} )[method] || ''

						const whitelist = permissions.split(',').filter( u => u != '').map( u => u.trim() ).map( parse )
						const apilist = endpoints.filter( a => a.type.toLowerCase() == method ).map( a => a.url ).map(parse) // !
						const foundA = match(cpath, whitelist) // !
						const foundB = match(cpath, apilist) // !

						if (foundA.length > 0 && foundB.length > 0) {

							// now we must match against the real endpoints (not shorthand)...
							
							regex = exec(cpath, foundB) // !
						}

						// ----------------------------------------
						// ----------------------------------------

						if (!regex) {
							console.log(`[api] 🛑  ${401} ${req.isAuthenticated()} "${user.username}" ${cpath} not authorised with ${JSON.stringify(permissions)}` )
							return sendError( res, 401, 'not authorised')
						}

						const args = ( item.type.toLowerCase() == 'get' ) ? req.query : req.body

						if ( args?.ezapi_permissions ) {
							return res.send( 'permitted' )
						}

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

							console.log(`[api] 🛑  ${422} ${req.method} ${req.path} invalid schema "${errs}" -> ${item.type} ${item.url}` )
							const extra = { args, schema, result } 
							return sendError( res, 422, errs, extra)
						}

						// process data

						// ----------------------------------------------

						let data = {}
						if (item.data) data = await item.data({
							...args, 
							regex 
						}, { 
							user, 
							opts, 
							req 
						})

						// ----------------------------------------------

						// perform res and req

						const colors = {
							get: '\x1b[92m',
							post: '\x1b[96m',
							delete: '\x1b[95m'
						}
						const c = colors[req.method.toLowerCase()]
						const e = '\033[0m'
						if (!opts.silent) console.log(`${c}[api] ✅  ${req.method} ${req.path} -> success! ${e}`)

						const send = item.next || ( (req, res, data) => res.send( data ) )
						return send( req, res, data )
						
					} catch(err) {

						let code = 500
						if (err.code == 'ENOENT') code = 404
						console.log(`[api] 🛑  ${code} ${req.method} ${req.path}`, err.message || err, err.stack || err )
						return sendError( res, 500, err.message || err )
						
					}
				})
			}
		})


		const server = app.listen( opts.port , async () => {

			const port = server.address().port
			console.log(`[api] ✨  server running on port: ${port}`)
		})

		return server
	}
}

