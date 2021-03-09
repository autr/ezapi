import svelte from 'rollup-plugin-svelte';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';
import css from 'rollup-plugin-css-only';
import preprocess from 'svelte-preprocess'
import alias from '@rollup/plugin-alias'
import path from 'path'

const production = !process.env.ROLLUP_WATCH;

function serve() {
	let server;

	function toExit() {
		if (server) server.kill(0);
	}

	return {
		writeBundle() {
			if (server) return;
			server = require('child_process').spawn('npm', ['run', 'start', '--', '--dev'], {
				stdio: ['ignore', 'inherit', 'inherit'],
				shell: true
			});

			process.on('SIGTERM', toExit);
			process.on('exit', toExit);
		}
	};
}

export default {
	input: 'src/overview.js',
	output: {
		sourcemap: false,
		format: 'iife',
		name: 'app',
		file: 'assets/index.js'
	},
	plugins: [
		alias({
			resolve: ['.js', '.svelte'],
			entries: [ { find: '@', replacement: path.resolve(__dirname, 'src') } ]
		}),
		svelte({

			preprocess: preprocess(),
			compilerOptions: {
				// enable run-time checks when not in production
				dev: !production
			}
		}),
		css({ output: 'index.css' }),
		resolve({
			browser: true,
			dedupe: ['svelte']
		}),
		commonjs(),
		!production && serve(),
		!production && livereload('assets'),
		production && terser()
	],
	watch: {
		clearScreen: true
	}
};
