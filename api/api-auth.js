// READ: https://levelup.gitconnected.com/everything-you-need-to-know-about-the-passport-local-passport-js-strategy-633bbab6195

const types = require('../types.js')
const flash = require('connect-flash')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const fs = require('fs')
const path = require('path')
const { spawn, execSync, spawnSync } = require('child_process')

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

module.exports = [

	// ---------------- CAT_AUTH ----------------

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
			console.log('....')
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
	}
]