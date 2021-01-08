const types = require('./types.js')
const util = require('./util.js')
const { ifconfig, iwconfig, iwlist, wpa, wpa_supplicant } = require("../modules/wireless-tools")
const pi_wifi = require("../modules/pi-wifi.js")

module.exports = [

	// ---------------- CAT_NET ----------------

	{
		url: '/ifconfig',
		type: 'get',	
		description: 'list of interfaces',
		category: types.CAT_NET,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			ifconfig.status( (err, data) => {
				(err) ? res.status(500).send( { message: err } ) : res.send( data )
			}) 
			
		}
	},
	{
		url: '/iwconfig',
		type: 'get',	
		description: 'list of active connections',
		category: types.CAT_NET,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			iwconfig.status( (err, data) => {
				(err) ? res.status(500).send( { message: err } ) : res.send( data )
			}) 
			
		}
	},
	{
		url: '/iwlist',
		type: 'get',	
		description: 'scan for networks',
		category: types.CAT_NET,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			iwlist.scan( { 
					iface: req.query.iface || 'wlan0',
					show_hidden: true
				}, (err, data) => {
				(err) ? res.status(500).send( { message: err } ) : res.send( data )
			}) 
			
		}
	},
	{
		url: '/wpa_status',
		type: 'get',	
		description: 'status of wpa_supplicant',
		category: types.CAT_NET,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			wpa.status( req.query.iface || 'wlan0', (err, data) => {
				(err) ? res.status(500).send( { message: err } ) : res.send( data )
			}) 
			
		}
	},
	{
		url: '/wpa_supplicant_enable',
		type: 'get',	
		description: 'connect to wifi network',
		category: types.CAT_NET,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			const opts = {
			  interface: req.query.iface || 'wlan0',
			  ssid: req.query.ssid,
			  passphrase: req.query.pass,
			  driver: 'wext'
			}
			if (!req.query.ssid) return res.status(500).send({ message: 'no ssid supplied'})
			wpa_supplicant.enable( opts, req.query.pass || '', (err, data) => {
				(err) ? res.status(500).send( { message: err } ) : res.send( data )
			}) 
		}
	},
	{
		url: '/connect',
		type: 'get',	
		description: 'connect to wifi network',
		category: types.CAT_NET,
		schema: {},
		returns: 'json',
		method: async function( req, res ) {
			if (!req.query.ssid) return res.status(500).send({ message: 'no ssid supplied'})
			pi_wifi.connect( req.query.ssid, req.query.pass || '', (err, data) => {
				(err) ? res.status(500).send( { message: err } ) : res.send( data )
			}) 
		}
	}

]

