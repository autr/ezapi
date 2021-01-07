const rollup = require('rollup');
const svelte = require('rollup-plugin-svelte')
const commonjs = require('rollup-plugin-commonjs')
const preprocess = require('svelte-preprocess')
const alias = require('@rollup/plugin-alias')
const path = require('path')

const production = true

const options =  {
	input: 'src/App.js',
	output: {
	},
	plugins: [
		alias({
			resolve: ['.js', '.svelte'],
			entries: [ { find: '@', replacement: path.resolve(__dirname, 'src') } ]
		}),
		commonjs(),
		svelte({
			preprocess: preprocess(),
			dev: !production,
			css: css => {
				css.write('bundle.css')
			}
		})
	]
}

async function build() {


	const bundle = await rollup.rollup( {
		input: 'src/App.js'
	})

	const { output } = await bundle.generate(outputOptions)

	await bundle.write( {

		file: 'blah.js',
		format: 'iife',
		name: 'app',
		sourcemap: false,
		plugins: [
			alias({
				resolve: ['.js', '.svelte'],
				entries: [ { find: '@', replacement: path.resolve(__dirname, 'src') } ]
			}),
			commonjs(),
			svelte({
				preprocess: preprocess(),
				dev: !production,
				css: css => {
					css.write('bundle.css')
				}
			})
		]
	})
	await bundle.close();
}

build()