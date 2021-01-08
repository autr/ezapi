const express = require('express')
const app = express()
const api = require( './api.js')
const fs = require('fs')
const path = require('path')

api.list.forEach( item => {
	if (item.type == 'use') {
		app[ item.type ]( item.method )
	} else {
		app[ item.type ]( item.url, item.method )
	}
})


const server = app.listen(3000, function() {
	const port = server.address().port
	console.log('Server running on http://127.0.0.1:%s', port)
})