const path = require('path')
const types = require( './types.js' )
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const session = require('express-session')
const express = require('express')
const passport = require('passport')
const cors = require('cors')

const overviewPath = path.join(__dirname, '../assets')
console.log(`[ezapi] 📺  serving endpoints to: ${overviewPath}`)

module.exports = async (opts, endpoints) => {
	const CORS = { origin: await opts.cors(), credentials: true }
	console.log(`setting cors:`, CORS)
	return [
		{
			type: 'use',
			next: cors( CORS ),
			description: 'cors origin policy',
			category: types.CAT_CORE
		},
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
			type: 'use', // this serves Svelte overview
			url: opts.apiRoot,
			next: express.static( overviewPath ),
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
				let out = {username:'guest',loggedin: false}
				if (req.isAuthenticated()) out = {username: req.user.username,loggedin: true}
				res.send( out )
			}
		}
	]
}