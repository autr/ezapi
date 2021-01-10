const types = require('../types.js')
const midi = require('midi');


module.exports = [

    {
        url: '/midi',
        type: 'get',
        description: 'list midi devices',
        category: types.CAT_COMMS,
        schema: {
        },
        data: async params => {
            let m = await new midi.Input();
            let inputs = []
            for ( let i = 0; i < m.getPortCount(); i += 1 ) {
              inputs.push( m.getPortName( i ) );
            }
            delete m
            m = await new midi.Output();
            let outputs = []
            for ( let i = 0; i < m.getPortCount(); i += 1 ) {
              outputs.push( m.getPortName( i ) );
            }
            return { inputs, outputs };
        }
    },
    {
        url: '/script',
        type: 'post',
        description: 'run a script',
        category: types.CAT_COMMS,
        schema: {
        },
        data: async params => {
            let m = await new midi.Input();
            let inputs = []
            for ( let i = 0; i < m.getPortCount(); i += 1 ) {
              inputs.push( m.getPortName( i ) );
            }
            delete m
            m = await new midi.Output();
            let outputs = []
            for ( let i = 0; i < m.getPortCount(); i += 1 ) {
              outputs.push( m.getPortName( i ) );
            }
            return { inputs, outputs };
        }
    }


]