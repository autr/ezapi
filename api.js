const types = require('./types.js')

let api = require( './api/api-config.js' )
.concat( require('./api/api-auth.js') )
.concat( require('./api/api-file.js') )
.concat( require('./api/api-media.js') )
.concat( require('./api/api-net.js') )
.concat( require('./api/api-proc.js') )
.concat( require('./api/api-sys.js') )
.concat( require('./api/api-comms.js') )
.concat( require('./api/api-ext.js') )
.concat( require('./modules/dataaa-api/index.js').endpoints )


api.push( 
	{
		url: '/endpoints',
		type: 'get',
		schema: {},
		data: async (params, user) => {
			const endpoints = api.map( a => {
				let { method, ...b } = a
				return b
			})
			return endpoints
		},
		description: 'show list of API endpoints',
		category: types.CAT_CONF
	}
)


api.push( 
	{
		url: '/package',
		type: 'get',
		schema: {},
		data: async (params, user) => {
			return JSON.parse( await ( await (require('fs')).readFileSync('./package.json') ).toString() )
		},
		description: 'view package.json',
		category: types.CAT_CONF
	}
)

const similarity = require('similarity')

api.push(
	{
		url: '/*',
		type: 'get',
		next: async (req, res, next) => {
			const match = api.map( o => { return {
				similarity: similarity( req.path, o.url ),
				name: o.url
			}}).sort( (a,b) => b.similarity - a.similarity )[0]
			res.status(404).send( { message: `no such endpoint ${req.path}, did you mean ${match.name}?`, code: 404 })
		},
		description: 'return error message',
		category: types.CAT_CONF
	}
)


module.exports = {
  list: api,
  keys: api.reduce( (o, i) => { o[i.url] = i; return o; }, {})
}

// microapi dataaa stapic miniapi miniapi-svelte-boilerplate