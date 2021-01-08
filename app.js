const express = require('express')
const app = express()
const api = require( './api.js')
const fs = require('fs')
const path = require('path')
const { inform } = require( './websockets.js' )
const { API_ERR, API_TRY, API_SUCCESS, API_OPEN, API_STDOUT, API_STDERR, API_CLOSE } = require('./types.js')

api.list.forEach( item => {
	if (item.type == 'use') {
		app[ item.type ]( item.data )
	} else {
		app[ item.type ]( item.url, async (req, res) => {
            try {
                const data = await item.data( req.query )
                const next = item.next || ((data, req, res) => res.send( data ))
                next( data, req, res )
            } catch(err) {
                inform( process.pid, API_ERR, err.message )
                res.send( { error: err.message } )
            }
        })
	}
})


const server = app.listen(3000, function() {
	const port = server.address().port
	console.log('Server running on http://127.0.0.1:%s', port)
})