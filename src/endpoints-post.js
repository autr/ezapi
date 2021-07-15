const path = require('path')
const types = require( './types.js' )

module.exports = (opts, endpoints) => [
	{
		url: '/endpoints',
		type: 'get',
		schema: {},
		data: async (params, user) => {
			return endpoints.map( a => {
				let { next, data, ...b } = a
				if (b.type != 'use') b.url = path.join( opts.apiRoot, b.url )
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
				message: `no such endpoint ${req.method.toUpperCase()} ${req.path}, did you mean ${match.type.toUpperCase()} ${path.join( opts.apiRoot, match.name )}?`, 
				code: 404 })
		},
		description: 'return error message if not found',
		category: types.CAT_CORE
	}
]