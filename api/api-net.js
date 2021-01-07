const types = require('./types.js')
const util = require('./util.js')
const wifi_control = require("wifi-control")

wifi_control.init( { debug: true, iface: 'wlan0' } )

// let interfaces = {}

const getInterface = async name => {
	// if (!interfaces[name]) await wifi_control.init
}

module.exports = [

	// ---------------- CAT_NET ----------------

	{
		url: '/dhcpcd',
		type: 'get',	
		description: 'show /etc/dhcpcd.conf contents',
		category: types.CAT_NET,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			const cat = module.exports.find( e => e.type == 'get' && e.url == '/cat')
			await cat.method( { query: { url: '/etc/dhcpcd.conf' } }  , res)
		}
	},
	{
		url: '/show_wifi',
		type: 'get',	
		description: 'show current wifi connection',
		category: types.CAT_NET,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			let data = await wifi_control.getIfaceState() 
			res.send( data )
		}
	},
	{
		url: '/scan_wifi',
		type: 'get',	
		description: 'scan for available wifi networks',
		category: types.CAT_NET,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			wifi_control.scanForWiFi( (err, data ) => {
				if (err) return res.status( 400 ).send( err )
				res.send( data )
			});
		}
	},
	{
		url: '/reset_wifi',
		type: 'get',	
		description: 'show dhcpcd.conf contents',
		category: types.CAT_NET,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			if (!req.user) return util.NO_AUTH( req, res )
			wifi_control.resetWiFi( (err, data ) => {
				if (err) return res.status( 400 ).send( err )
				res.send( data )
			});
		}
	},
	{
		url: '/connect_wifi',
		type: 'get',	
		description: 'show dhcpcd.conf contents',
		category: types.CAT_NET,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			if (!req.user) return util.NO_AUTH( req, res )
			wifi_control.connectToAP( {
				ssid: req.query.ssid,
				password: req.query.password
			}, (message, data ) => {
				if (message) return res.status( 400 ).send( { message } )
				res.send( data )
			});
		}
	}

]