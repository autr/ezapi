const eazapi = require('./index.js')
const CAT_EXAMPLE = 'example'
return eazapi.app( [

	{
		url: '/example_get/:id/:name/:cat',
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

			return { foo: 'bar', ...params, thing: 'fsdfdsfjh kj dsdkjs kjh kjh kjh kjh kjh kjhkjhkjhkjhkj hk jh kjhkjhkjh kjhkjhkjhkj jkhkjhkj kjhkjhkjhkjh ', dsfds: params, jkads: params }
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

			return { hello: 'world', ...params }
		}
	}

], {nocache: true} )