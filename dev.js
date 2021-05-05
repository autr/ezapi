const eazapi = require('./index.js')
const CAT_EXAMPLE = 'example'
return eazapi.app( [

	{
		url: '/example_get',
		type: 'get',
		description: 'example get',
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

			return { foo: 'bar', ...params }
		}
	},
	{
		url: '/example_post',
		type: 'post',
		description: 'example get',
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

			return { hello: 'world', ...params }
		}
	}

], {nocache: true} )