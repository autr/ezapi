// READ: https://levelup.gitconnected.com/everything-you-need-to-know-about-the-passport-local-passport-js-strategy-633bbab6195

const types = require('../types.js')
const flash = require('connect-flash')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const fs = require('fs')
const path = require('path')
const { pamAuthenticate, pamErrors } = require('node-linux-pam')

passport.use('login', new LocalStrategy( async (username, password, done) => {

	console.log('[api-auth] ⚡️  logging in with pam:', username)
	try {
		const users = JSON.parse( await (await fs.readFileSync( path.resolve(__dirname, '../bin/users.json'))).toString() )
		const u = users.find( o => o.username == username )
		if (!u)  {
			const m = `no user with name "${username}" found`
			console.log('[api-auth] 🛑  (A) error logging in:', m)
			return done(null, false, { message: m } )
		}

		const res = await (new Promise( (resolve, reject) => {
			console.log(`[api-auth] ⚡️  authenticatiing "${username}" with pam...`)
			pamAuthenticate( { username, password }, function(err, code) {
				const message = Object.keys( pamErrors ).find(key => pamErrors[key] == code)
				if ( err ) reject({ message, code }) 
				else resolve({ message, code })
			})
		}))

		if ( res.code != 0 ) {
			console.log('[api-auth] 🛑  (C) error logging in:', res.message)
			return done(null, false, res.message )
		}
		
		console.log('[api-auth] ✅  success logging in:', username)
		return done(null, u)
	} catch(err) {
		console.log('[api-auth] ❌  (D) error logging in:', err.message)
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
		console.log('[api-auth] ✅  deserialized:', username)
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
			req.logout()
			res.redirect('/')
		}
	},
	{
		url: '/login',
		type: 'get',
		description: 'basic HTML login',
		category: types.CAT_AUTH,
		schema: {},
		emoji: '🔑',
		next: async (req, res, data) => res.send(`
				<form action="/login" method="POST">
					<p><input name="username" type="text" /></p>
					<p><input name="password" type ="password" /></p>
					<p><input type="submit" value="Login" /></p>
					<p style="color: hsl(0, 90%, 70%)">${req.flash('error')}</p>
				</form> ` )
	},
	{
		url: '/login',
		type: 'post',
		description: 'login with username and password',
		category: types.CAT_AUTH,
		schema: {},
		emoji: '🔑',
		next: passport.authenticate('login', {
			successRedirect: '/',
			failureRedirect: '/login',
			failureFlash: true
		})
	},
	{
		url: '/status',
		type: 'get',
		description: 'authorisation status',
		category: types.CAT_AUTH,
		schema: {},
		emoji: '🔒',
		data: e => null
	}
]