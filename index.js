
const fs = require('fs')
const crypto = require('crypto')
const path = require('path')
const os = require('os')
const { spawn, execSync, spawnSync } = require('child_process')

const cors = require('cors')
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

function cleanRequestPath( url, root ) {
	if (url.substring(0,root.length) == root) return url.substring(root.length)
	return url
}

function getRegex( url, endpoints ) {
	const urls = endpoints.map( e => e.url ).filter( e => e).map( parse )
	const found = match( url, urls)
	const regex = exec(url, found)
	return regex
}

// perform res and req

const colors = {
	green: '\x1b[92m',
	blue: '\x1b[96m',
	pink: '\x1b[95m',
	yellow: '\x1b[103m',
	end: '\033[0m'
}

const icon = {
	GET: '\x1b[102mGET\033[0m',
	POST: '\x1b[104mPOST\033[0m',
	PUT: '\x1b[104mPUT\033[0m',
	DELETE: '\x1b[105mDELETE\033[0m'
}

const log = {}

Object.keys(colors).forEach( c => {
	log[c] = text => {
		console.log(`${colors[c]}${text}${colors.end}`)
	}
})

module.exports = {
	types,
	app: async ( _endpoints, _opts, _auth ) => {


		if ( !Array.isArray( _endpoints ) ) throw '[ezapi] first argument "endpoints" is not an array'
		if ( typeof(_opts) != 'object' && typeof(_opts) != 'undefined' ) throw '[ezapi] second argument "options" is not a object'

		const SECRET = require('crypto').randomBytes(64).toString('hex')

		let opts = {
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
			cors: async e => {

				const CORS = process.env.EZAPI_CORS

				if (CORS == undefined) throw `no cors set with env variable EZAPI_CORS`
				const out = {
					// exposedHeaders: ['set-cookie'],
					// credentials: true, 
					origin: CORS.split(',')
				}
				return out

			},
			nocache: false,
			...(_opts||{})
		}

		log.yellow(`[ezapi] 🚰  using port ${opts.port}`)

		if (!opts.session.secret) opts.session.secret = SECRET

		const endpoints = [
			...(await endpointsPre( opts, _endpoints )),
			..._endpoints, // <--- endpoints
			...(await endpointsPost( opts, _endpoints ))
		]

		if (opts.nocache) app.use(nocache())


		const auth = { 
			strategy: async ( req, username, password, done ) => {

				const clean = cleanRequestPath( req.path, opts.apiRoot )
				const regex = getRegex( clean, endpoints )
				log.yellow(`[ezapi]  strategy ${username} p**sw**d`)

				const token = await crypto.scryptSync( password, process.env.EZAPI_KEY, 64).toString('hex')
				const hasAdmin = username == 'admin' || ( username == process.env.EZAPI_ADMIN && username )
				const hasPassword = (token == process.env.EZAPI_PASSWORD) && password

				if ( hasAdmin && hasPassword ) {
					done( null, { username: 'admin' } )
				} else {
					done( null, false, 'incorrect password')
				}
			},
			serialize: async (user, done) => {

				log.yellow(`[ezapi]  deserialise ${user?.username}`)
				done(null, user.username)
			},
			deserialize: async (req, username, done) => {
				log.yellow(`[ezapi]  deserialise ${username}`)
				if (username == 'admin') {
					done( null, { username } ) 
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

		passport.use('login', new LocalStrategy( { passReqToCallback: true }, auth.strategy ) )
		passport.serializeUser( auth.serialize )
		passport.deserializeUser( auth.deserialize )


		const sendError = ( res, code, message, extra ) => {
			const json = { message, code, status: code, error: true, ...extra }
			res.status( code ).send( json )
		}
		const CORS = await opts.cors()

		endpoints.forEach( item => {

			const EMOJI = item.type == 'use' ? '🔧' : item.type == 'get' ? '🍬' : '✉️'

			if (!opts.silent) log.blue(`[ezapi] ${EMOJI}  ${item.type.toUpperCase()}: ${item.url || '~'} ${ item.type == 'use' ? item.description : ''}`)
			if (item.type == 'use') {
				if (item.url)
					app[ item.type ]( item.url, item.next )
				else
					app[ item.type ]( item.next )
			} else {


				app[ item.type ]( path.join( opts.apiRoot, item.url ), async (req, res) => {

					const METHOD = icon[req.method.toUpperCase()]
					let args = ( item.type.toLowerCase() == 'get' ) ? req.query : req.body
					const CHECK_PERMISSIONS = args?.ezapi_permissions

					try {

						let ipV4 = req.connection.remoteAddress.replace(/^.*:/, '')
						if (ipV4 === '1') ipV4 = 'localhost'
						if (!opts.silent) console.log(`[ezapi] 🐟  ---> request from "${ipV4}"...`) 

						// const info = (new ua()).setUA( req.headers['user-agent'] ).getResult()

						// ----------------------------------------
						// isAllowed ->
						// ----------------------------------------

						let regex = null
						let user = req.isAuthenticated() ? req.user : { username: 'guest' }

						if (!opts.silent) log.blue(`[ezapi] 👤  ${METHOD} ${req.path} <--- ${user?.username || user}`)

						const meth = req.method.toLowerCase()

						let cpath = req.path
						if (cpath.substring(0,opts.apiRoot.length) == opts.apiRoot) {
							// clean path
							cpath = cpath.substring(opts.apiRoot.length)
						}
						const permissions = ( await auth.permissions( user ) || {} )[meth] || ''

						const whitelist = permissions.split(',').filter( u => u != '').map( u => u.trim() ).map( parse )
						const apilist = endpoints.filter( a => a.type.toLowerCase() == meth ).map( a => a.url ).map(parse) // !
						const foundA = match(cpath, whitelist) // !
						const foundB = match(cpath, apilist) // !

						if (foundA.length > 0 && foundB.length > 0) {

							// now we must match against the real endpoints (not shorthand)...
							
							regex = exec(cpath, foundB) // !
						}

						// ----------------------------------------

						if (!regex) {
							log.pink(`[ezapi] 🛑  ${401} ${req.isAuthenticated()} "${user.username}" ${cpath} not authorised with permissions for "${JSON.stringify(permissions)}"` )
							return sendError( res, 401, 'not authorised')
						}

						// checking permissions!

						if ( CHECK_PERMISSIONS ) return res.send( 'permitted' )

						// check schema

						const schema = {
							type: 'object',
							properties: item.schema
						}

						// convert (get) url params into actual json (ie. boolean, integer etc)

						if ( meth == 'get' ) {
							for (const [k, v] of Object.entries(args)) {
								args[k] = JSON.parse( v.toLowerCase() )
							}
						}

						const result = validate( args, schema, {required: true} )

						if (!result.valid) {
							const errs = result.errors.map( err => { 
								return err.path[err.path.length-1] + ' ' + err.message
							}).join('\n')

							log.pink(`[ezapi] 🛑  ${422} ${METHOD} ${req.path} invalid schema "${errs}" -> ${item.type} ${item.url}` )
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

						if (!opts.silent) log.green(`[ezapi] ✅  ${METHOD} ${req.path} ---> success`)

						const send = item.next || ( (req, res, data) => res.send( data ) )
						return send( req, res, data )
						
					} catch(err) {

						let code = 500
						if (err.code == 'ENOENT') code = 404
						log.pink(`[ezapi] 🛑  ${code} ${METHOD} ${req.path} ${err.message || err, err.stack || err}` )
						return sendError( res, 500, err.message || err )
						
					}
				})
			}
		})


		const server = app.listen( opts.port , async () => {
			const port = server.address().port
			log.yellow(`[ezapi] ✨  server running on port: ${port}`)
		})

		return server
	}
}

