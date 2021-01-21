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
.concat( require('./modules/dataaa-api/index.js').api )


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



module.exports = {
  list: api,
  keys: api.reduce( (o, i) => { o[i.url] = i; return o; }, {})
}

// microapi dataaa stapic miniapi miniapi-svelte-boilerplate