// READ: https://levelup.gitconnected.com/everything-you-need-to-know-about-the-passport-local-passport-js-strategy-633bbab6195

const types = require('../types.js')
const flash = require('connect-flash')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy
const fs = require('fs')
const path = require('path')
const { pamAuthenticate } = require('node-linux-pam')

passport.use('login', new LocalStrategy( async (username, password, done) => {

	console.log('[api-auth] ⚡️  logging in with pam:', username)
	try {
		const users = JSON.parse( await (await fs.readFileSync( path.resolve(__dirname, '../bin/users.json'))).toString() )
		const u = users.find( o => o.username == username )
		if (!u)  {
			const m = `no user with name "${username}" found`
			console.log('[api-auth] 🛑  error logging in:', m)
			return done(null, false, { message: m } )
		}
		if (u.password != password)  {
			const m = `incorrect password for "${username}"`
			console.log('[api-auth] 🛑  error logging in:', m)
			return done(null, false, { message: m } )
		}


		const res = await (new Promise( (resolve, reject) => {
			pamAuthenticate( { username, password }, function(err, code) {
				if (!err) return reject({err,code})
				return resolve({err,code})
			})
		}))

		if ( res.err ) {
			console.log('[api-auth] 🛑  error logging in:', res)
			return done(null, false, err )
		}
		
		console.log('[api-auth] ✅  success logging in:', username)
		return done(null, u)
	} catch(err) {
		console.log('[api-auth] ❌  error logging in:', err.message)
		return done( JSON.stringify({ error: err.message }, null, 2) )
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
					<p><input name="username"></p>
					<p><input name="password"></p>
					<p><input type="submit" value="Login"></p>
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