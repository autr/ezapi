const types = require('../types.js')
const flash = require('connect-flash')
const passport = require('passport')
const LocalStrategy = require('passport-local').Strategy

const fs = require('fs')
const path = require('path')

// resolve users data

const a = path.resolve(__dirname, '../users.template.js')
const b = path.resolve(__dirname, '../users.js')
const exists = fs.existsSync( b )
if ( !exists ) {
	console.log(`[api.js] 🌐 🚨  creating default: "${b}"`)
	fs.copyFileSync( a, b )
}

const users = require('../users.js')
const user = users[0]

passport.use('login', new LocalStrategy(
	(username, password, done) => {
		const match = (username === user.username && password === user.password)
		if( match ) {
			return done( null, user )
		} else {
			done(null, false, { message: 'Invalid username and password.' })
		}
	}
))

// required for storing user info into session 

passport.serializeUser( (user, done) => {
	done(null, user._id)
})
 
// required for retrieving user from session

passport.deserializeUser( (id, done) => {

	// the user should be queried against db, using the id
	
	done(null, user)
})

module.exports = [

	{
		type: 'use',
		data: passport.initialize(),
		description: 'auth initialize',
		category: types.CAT_AUTH
	},
	{
		type: 'use',
		data: passport.session(),
		description: 'auth session',
		category: types.CAT_AUTH
	},
	{
		type: 'use',
		data: flash(),
		description: 'storing log errors with flash()',
		category: types.CAT_AUTH
	},

	// ---------------- CAT_AUTH ----------------

	{
		url: '/logout',
		type: 'get',
		description: 'log out of api',
		category: types.CAT_AUTH,
		schema: {},
		data: async params => null,
		next: async (data, req, res) => {
			req.logout()
			res.redirect('/')
		}
	},
	{
		url: '/login',
		type: 'get',
		description: 'log into api',
		category: types.CAT_AUTH,
		schema: {},
		data: async params => null,
		next: async (data, req, res) => res.send(`
				<form action="/login" method="POST">
					<p><input name="username"></p>
					<p><input name="password"></p>
					<p><input type="submit" value="Login"></p>
					<p style="color: hsl(0, 90%, 70%)">${req.flash('error')}</p>
				</form> ` + style )
	},
	{
		url: '/login',
		type: 'post',
		description: 'post username and password to log in',
		category: types.CAT_AUTH,
		schema: {},
		data: async params => null,
		next: async (data, req, res) => passport.authenticate('login', {
			successRedirect: '/',
			failureRedirect: '/login',
			failureFlash: true
		})
	}
]