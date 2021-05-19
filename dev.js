const eazapi = require('./index.js')
const CAT_EXAMPLE = 'example'
return eazapi.app( [

	{
		url: '/example_get/:section/:name/:id',
		type: 'get',
		description: 'example get lorem sdfdsfds sdf sdf s',
		category: CAT_EXAMPLE,
		schema: {
			name: {
				type: 'string',
				example: 'Terrence McKenna'
			},
			email: {
				type: 'string',
				example: 't@kenna.org'
			},
			onoff: {
				type: 'boolean',
				example: true
			}
		},
		data: async params => {

			return { params }
		}
	},
	{
		url: '/:root/:category/example_post',
		type: 'post',
		description: 'example get',
		category: CAT_EXAMPLE,
		schema: {
			name: {
				type: 'string',
				example: 'Terrence McKenna',
				required: true
			},
			email: {
				type: 'string',
				example: 't@kenna.org',
				required: true
			},
			onoff: {
				type: 'boolean',
				example: true
			}
		},
		data: async params => {

			return { params}
		}
	}

], { 
	port: 3001,
	nocache: true
} )