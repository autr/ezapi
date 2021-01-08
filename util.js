module.exports = {
	NO_AUTH: ( req, res ) => {
		return res.status( 401 ).send( { message: 'not authenticated' })
	}
}