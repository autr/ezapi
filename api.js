
const rclone_api = require('rclone-api')

const api = require( './api/api-config.js' )
.concat( require('./api/api-auth.js') )
.concat( require('./api/api-file.js') )
.concat( require('./api/api-media.js') )
.concat( require('./api/api-net.js') )
.concat( require('./api/api-proc.js') )
.concat( require('./api/api-sys.js') )

module.exports = {
  list: api,
  keys: api.reduce( (o, i) => { o[i.url] = i; return o; }, {})
}