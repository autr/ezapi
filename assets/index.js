
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot(slot, slot_definition, ctx, $$scope, dirty, get_slot_changes_fn, get_slot_context_fn) {
        const slot_changes = get_slot_changes(slot_definition, $$scope, dirty, get_slot_changes_fn);
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function exclude_internal_props(props) {
        const result = {};
        for (const k in props)
            if (k[0] !== '$')
                result[k] = props[k];
        return result;
    }
    function compute_slots(slots) {
        const result = {};
        for (const key in slots) {
            result[key] = true;
        }
        return result;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_input_value(input, value) {
        input.value = value == null ? '' : value;
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }
    class HtmlTag {
        constructor(anchor = null) {
            this.a = anchor;
            this.e = this.n = null;
        }
        m(html, target, anchor = null) {
            if (!this.e) {
                this.e = element(target.nodeName);
                this.t = target;
                this.h(html);
            }
            this.i(anchor);
        }
        h(html) {
            this.e.innerHTML = html;
            this.n = Array.from(this.e.childNodes);
        }
        i(anchor) {
            for (let i = 0; i < this.n.length; i += 1) {
                insert(this.t, this.n[i], anchor);
            }
        }
        p(html) {
            this.d();
            this.h(html);
            this.i(this.a);
        }
        d() {
            this.n.forEach(detach);
        }
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function get_spread_update(levels, updates) {
        const update = {};
        const to_null_out = {};
        const accounted_for = { $$scope: 1 };
        let i = levels.length;
        while (i--) {
            const o = levels[i];
            const n = updates[i];
            if (n) {
                for (const key in o) {
                    if (!(key in n))
                        to_null_out[key] = 1;
                }
                for (const key in n) {
                    if (!accounted_for[key]) {
                        update[key] = n[key];
                        accounted_for[key] = 1;
                    }
                }
                levels[i] = n;
            }
            else {
                for (const key in o) {
                    accounted_for[key] = 1;
                }
            }
        }
        for (const key in to_null_out) {
            if (!(key in update))
                update[key] = undefined;
        }
        return update;
    }
    function get_spread_object(spread_props) {
        return typeof spread_props === 'object' && spread_props !== null ? spread_props : {};
    }

    function bind(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.38.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    // https://danlevy.net/you-may-not-need-axios

    const error$1 = ( code, message ) => {
        return { code, status: code, error: true, ok: false, message }
    };
    const success = ( data ) => {
    	return { code: 200, status: 200, error: false, ok: true, data }
    };

    const rest = async ( method, url, args, silent ) => {

    	if ( Array.isArray(url) ) url = url.join('/');

    	try {

    		let config = {};

    		if ( method == 'del' ) {
    			config = {
    				...config,
    				credentials: 'include', // same-origin,
    				method: 'DELETE'
    			};
    		}

    		if ( method == 'get' && args ) {
    			const keys = Object.keys( args );
    			for (let i = 0; i < keys.length; i++) {
    				const key = keys[i];
    				if (i == 0) url += '?';
    				if ( args[key] != undefined && args[key] != '' ) {
    					url += `${key}=${encodeURIComponent(args[key])}`;
    					if (i != keys.length - 1) url += '&';
    				}
    			}
    			config = {
    				...config,
    				credentials: 'include', // same-origin,
    				method: method.toUpperCase()
    			};
    		}

    		if ( method == 'put' || method == 'post' ) {

    			config = {
    				...config,
    				credentials: 'include', // same-origin,
    				method: method.toUpperCase(),
    				body: JSON.stringify( args || {} ),
    				headers: { 'Content-Type': 'application/json' }
    			};
    		}
    		if ( !silent ) console.log(`[fetcher] 🌟  ${url}`, config);

    		const res = await fetch( url, config );
    		let data = await res.text();
    	    try { data = JSON.parse( data ); } catch(err) { data = await res.text(); }

    		if ( !res.ok || data.error ) console.log(`[fetcher] ❌  ${url}`, data.message, data.status, data.code);

    	    if ( !res.ok || data.error ) return data

    		if ( !silent ) console.log(`[fetcher] ✅  ${url}`, data);

    		return success( data )

    	} catch(err) {
    		if ( !silent ) console.log(`[fetcher] ❌  ${url}`, err.message, err.status, err.code);
    		return error$1( 500, err.message )
    	}
    };

    const names = ['get','post','del','put'];
    let out = {};

    names.forEach( n => {
    	out[n] = async( url, args, silent ) => {
    		return await rest( n, url, args, silent )
    	};
    });


    var fetcher = out;

    function log( msg ) {
    	console.log( `[svelte-tabular-table] ${msg}`);
    }

    const defaults = {
    	hover: o => log(`${o.id} "${o.key}" -> hovered`),
    	click: o => log(`${o.id} "${o.key}" -> clicked`),
    	render: o => o.value,
    	checked: o => log(`${o.id} -> ${o.event.target.checked ? 'checked' : 'unchecked'}`),
    	sort: (conf, data, meta) => {
    		data.sort( (a,b) => {
    			let aa = a[conf.key] || '';
    			let bb = b[conf.key] || '';
    			if ( typeof(aa) == 'string' ) aa = aa.toLowerCase();
    			if ( typeof(bb) == 'string' ) bb = bb.toLowerCase();
    			return +(aa > bb) || +(aa === bb) - 1
    		});
    		if ( conf.direction ) data = data.reverse();
    		return data
    	},
    	dimensions: {
    		row: null,
    		padding: 10,
    		widths: []
    	}
    };
    const slugify = text => text.toString().toLowerCase()
    	.replaceAll(' ', '-')           // Replace spaces with -
    	.replace(/[^\w\-]+/g, '');       // Remove all non-word chars

    /* node_modules/.pnpm/svelte-tabular-table@1.0.5/node_modules/svelte-tabular-table/src/Td.svelte generated by Svelte v3.38.2 */
    const file$3 = "node_modules/.pnpm/svelte-tabular-table@1.0.5/node_modules/svelte-tabular-table/src/Td.svelte";

    // (86:1) {:else}
    function create_else_block_2$1(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block_3$2, create_else_block_4];
    	const if_blocks = [];

    	function select_block_type_3(ctx, dirty) {
    		if (!/*$$slots*/ ctx[14].default) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_3(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "style", /*style*/ ctx[8]);
    			add_location(div, file$3, 86, 2, 2256);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_3(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(div, null);
    			}

    			if (!current || dirty[0] & /*style*/ 256) {
    				attr_dev(div, "style", /*style*/ ctx[8]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2$1.name,
    		type: "else",
    		source: "(86:1) {:else}",
    		ctx
    	});

    	return block;
    }

    // (79:1) {#if init.nodiv}
    function create_if_block$3(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1$2, create_else_block_1$1];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (!/*$$slots*/ ctx[14].default) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_1(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(79:1) {#if init.nodiv}",
    		ctx
    	});

    	return block;
    }

    // (91:3) {:else}
    function create_else_block_4(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[29].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[28], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty[0] & /*$$scope*/ 268435456)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[28], dirty, null, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_4.name,
    		type: "else",
    		source: "(91:3) {:else}",
    		ctx
    	});

    	return block;
    }

    // (88:3) {#if !$$slots.default }
    function create_if_block_3$2(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_4$1, create_else_block_3];
    	const if_blocks = [];

    	function select_block_type_4(ctx, dirty) {
    		if (/*component*/ ctx[7]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_4(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_4(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$2.name,
    		type: "if",
    		source: "(88:3) {#if !$$slots.default }",
    		ctx
    	});

    	return block;
    }

    // (90:4) {:else}
    function create_else_block_3(ctx) {
    	let html_tag;
    	let html_anchor;

    	const block = {
    		c: function create() {
    			html_anchor = empty();
    			html_tag = new HtmlTag(html_anchor);
    		},
    		m: function mount(target, anchor) {
    			html_tag.m(/*render*/ ctx[12], target, anchor);
    			insert_dev(target, html_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*render*/ 4096) html_tag.p(/*render*/ ctx[12]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(html_anchor);
    			if (detaching) html_tag.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_3.name,
    		type: "else",
    		source: "(90:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (89:4) {#if component }
    function create_if_block_4$1(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*obj*/ ctx[5]];
    	var switch_value = /*renderFunc*/ ctx[6];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty[0] & /*obj*/ 32)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*obj*/ ctx[5])])
    			: {};

    			if (switch_value !== (switch_value = /*renderFunc*/ ctx[6])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4$1.name,
    		type: "if",
    		source: "(89:4) {#if component }",
    		ctx
    	});

    	return block;
    }

    // (83:2) {:else}
    function create_else_block_1$1(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[29].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[28], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty[0] & /*$$scope*/ 268435456)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[28], dirty, null, null);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1$1.name,
    		type: "else",
    		source: "(83:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (80:2) {#if !$$slots.default }
    function create_if_block_1$2(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_2$2, create_else_block$2];
    	const if_blocks = [];

    	function select_block_type_2(ctx, dirty) {
    		if (/*component*/ ctx[7]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_2(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_2(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(80:2) {#if !$$slots.default }",
    		ctx
    	});

    	return block;
    }

    // (82:3) {:else}
    function create_else_block$2(ctx) {
    	let html_tag;
    	let html_anchor;

    	const block = {
    		c: function create() {
    			html_anchor = empty();
    			html_tag = new HtmlTag(html_anchor);
    		},
    		m: function mount(target, anchor) {
    			html_tag.m(/*render*/ ctx[12], target, anchor);
    			insert_dev(target, html_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*render*/ 4096) html_tag.p(/*render*/ ctx[12]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(html_anchor);
    			if (detaching) html_tag.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(82:3) {:else}",
    		ctx
    	});

    	return block;
    }

    // (81:3) {#if component }
    function create_if_block_2$2(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*obj*/ ctx[5]];
    	var switch_value = /*renderFunc*/ ctx[6];

    	function switch_props(ctx) {
    		let switch_instance_props = {};

    		for (let i = 0; i < switch_instance_spread_levels.length; i += 1) {
    			switch_instance_props = assign(switch_instance_props, switch_instance_spread_levels[i]);
    		}

    		return {
    			props: switch_instance_props,
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const switch_instance_changes = (dirty[0] & /*obj*/ 32)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*obj*/ ctx[5])])
    			: {};

    			if (switch_value !== (switch_value = /*renderFunc*/ ctx[6])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$2.name,
    		type: "if",
    		source: "(81:3) {#if component }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let td;
    	let current_block_type_index;
    	let if_block;
    	let td_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const if_block_creators = [create_if_block$3, create_else_block_2$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*init*/ ctx[0].nodiv) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			td = element("td");
    			if_block.c();
    			attr_dev(td, "style", /*tdStyle*/ ctx[9]);
    			attr_dev(td, "colspan", /*colspan*/ ctx[2]);
    			attr_dev(td, "width", /*width*/ ctx[4]);
    			attr_dev(td, "class", td_class_value = /*class_*/ ctx[3] + " stt-" + slugify(/*key*/ ctx[1]));
    			attr_dev(td, "data-key", /*key*/ ctx[1]);
    			toggle_class(td, "stt-sorted", /*same*/ ctx[11]);
    			toggle_class(td, "stt-ascending", /*same*/ ctx[11] && /*direction*/ ctx[10]);
    			toggle_class(td, "stt-descending", /*same*/ ctx[11] && !/*direction*/ ctx[10]);
    			add_location(td, file$3, 69, 0, 1819);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, td, anchor);
    			if_blocks[current_block_type_index].m(td, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(td, "click", /*click_handler*/ ctx[30], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(td, null);
    			}

    			if (!current || dirty[0] & /*tdStyle*/ 512) {
    				attr_dev(td, "style", /*tdStyle*/ ctx[9]);
    			}

    			if (!current || dirty[0] & /*colspan*/ 4) {
    				attr_dev(td, "colspan", /*colspan*/ ctx[2]);
    			}

    			if (!current || dirty[0] & /*width*/ 16) {
    				attr_dev(td, "width", /*width*/ ctx[4]);
    			}

    			if (!current || dirty[0] & /*class_, key*/ 10 && td_class_value !== (td_class_value = /*class_*/ ctx[3] + " stt-" + slugify(/*key*/ ctx[1]))) {
    				attr_dev(td, "class", td_class_value);
    			}

    			if (!current || dirty[0] & /*key*/ 2) {
    				attr_dev(td, "data-key", /*key*/ ctx[1]);
    			}

    			if (dirty[0] & /*class_, key, same*/ 2058) {
    				toggle_class(td, "stt-sorted", /*same*/ ctx[11]);
    			}

    			if (dirty[0] & /*class_, key, same, direction*/ 3082) {
    				toggle_class(td, "stt-ascending", /*same*/ ctx[11] && /*direction*/ ctx[10]);
    			}

    			if (dirty[0] & /*class_, key, same, direction*/ 3082) {
    				toggle_class(td, "stt-descending", /*same*/ ctx[11] && !/*direction*/ ctx[10]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(td);
    			if_blocks[current_block_type_index].d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let width;
    	let _refresh;
    	let _style;
    	let style;
    	let tdStyle;
    	let hasSlot;
    	let obj;
    	let cbs;
    	let renderFunc;
    	let clickFunc;
    	let sorting;
    	let direction;
    	let same;
    	let render;
    	let component;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Td", slots, ['default']);
    	const $$slots = compute_slots(slots);
    	let { init } = $$props;
    	let { dimensions } = $$props;
    	let { debug } = $$props;
    	let { callbacks } = $$props;
    	let { features } = $$props;
    	let { misc } = $$props;
    	let { id } = $$props;
    	let { item } = $$props;
    	let { key } = $$props;
    	let { index } = $$props;
    	let { type } = $$props;
    	let { colspan = 1 } = $$props;
    	let { class: class_ = "" } = $$props;

    	function onClick(obj, e) {
    		clickFunc({ ...obj, event: e });
    		const exists = init.keys.indexOf(key) != -1;

    		if (type == "key" && exists && sorting) {
    			misc.reorder({ id, item, key, e });
    		}
    	}

    	const click_handler = e => onClick(obj, e);

    	$$self.$$set = $$new_props => {
    		$$invalidate(33, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("init" in $$new_props) $$invalidate(0, init = $$new_props.init);
    		if ("dimensions" in $$new_props) $$invalidate(15, dimensions = $$new_props.dimensions);
    		if ("debug" in $$new_props) $$invalidate(16, debug = $$new_props.debug);
    		if ("callbacks" in $$new_props) $$invalidate(17, callbacks = $$new_props.callbacks);
    		if ("features" in $$new_props) $$invalidate(18, features = $$new_props.features);
    		if ("misc" in $$new_props) $$invalidate(19, misc = $$new_props.misc);
    		if ("id" in $$new_props) $$invalidate(20, id = $$new_props.id);
    		if ("item" in $$new_props) $$invalidate(21, item = $$new_props.item);
    		if ("key" in $$new_props) $$invalidate(1, key = $$new_props.key);
    		if ("index" in $$new_props) $$invalidate(22, index = $$new_props.index);
    		if ("type" in $$new_props) $$invalidate(23, type = $$new_props.type);
    		if ("colspan" in $$new_props) $$invalidate(2, colspan = $$new_props.colspan);
    		if ("class" in $$new_props) $$invalidate(3, class_ = $$new_props.class);
    		if ("$$scope" in $$new_props) $$invalidate(28, $$scope = $$new_props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		defaults,
    		slugify,
    		init,
    		dimensions,
    		debug,
    		callbacks,
    		features,
    		misc,
    		id,
    		item,
    		key,
    		index,
    		type,
    		colspan,
    		class_,
    		onClick,
    		width,
    		_refresh,
    		_style,
    		style,
    		tdStyle,
    		sorting,
    		hasSlot,
    		obj,
    		cbs,
    		renderFunc,
    		clickFunc,
    		direction,
    		same,
    		render,
    		component
    	});

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(33, $$props = assign(assign({}, $$props), $$new_props));
    		if ("init" in $$props) $$invalidate(0, init = $$new_props.init);
    		if ("dimensions" in $$props) $$invalidate(15, dimensions = $$new_props.dimensions);
    		if ("debug" in $$props) $$invalidate(16, debug = $$new_props.debug);
    		if ("callbacks" in $$props) $$invalidate(17, callbacks = $$new_props.callbacks);
    		if ("features" in $$props) $$invalidate(18, features = $$new_props.features);
    		if ("misc" in $$props) $$invalidate(19, misc = $$new_props.misc);
    		if ("id" in $$props) $$invalidate(20, id = $$new_props.id);
    		if ("item" in $$props) $$invalidate(21, item = $$new_props.item);
    		if ("key" in $$props) $$invalidate(1, key = $$new_props.key);
    		if ("index" in $$props) $$invalidate(22, index = $$new_props.index);
    		if ("type" in $$props) $$invalidate(23, type = $$new_props.type);
    		if ("colspan" in $$props) $$invalidate(2, colspan = $$new_props.colspan);
    		if ("class_" in $$props) $$invalidate(3, class_ = $$new_props.class_);
    		if ("width" in $$props) $$invalidate(4, width = $$new_props.width);
    		if ("_refresh" in $$props) $$invalidate(24, _refresh = $$new_props._refresh);
    		if ("_style" in $$props) $$invalidate(25, _style = $$new_props._style);
    		if ("style" in $$props) $$invalidate(8, style = $$new_props.style);
    		if ("tdStyle" in $$props) $$invalidate(9, tdStyle = $$new_props.tdStyle);
    		if ("sorting" in $$props) $$invalidate(26, sorting = $$new_props.sorting);
    		if ("hasSlot" in $$props) hasSlot = $$new_props.hasSlot;
    		if ("obj" in $$props) $$invalidate(5, obj = $$new_props.obj);
    		if ("cbs" in $$props) $$invalidate(27, cbs = $$new_props.cbs);
    		if ("renderFunc" in $$props) $$invalidate(6, renderFunc = $$new_props.renderFunc);
    		if ("clickFunc" in $$props) clickFunc = $$new_props.clickFunc;
    		if ("direction" in $$props) $$invalidate(10, direction = $$new_props.direction);
    		if ("same" in $$props) $$invalidate(11, same = $$new_props.same);
    		if ("render" in $$props) $$invalidate(12, render = $$new_props.render);
    		if ("component" in $$props) $$invalidate(7, component = $$new_props.component);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*index, dimensions*/ 4227072) {
    			$$invalidate(4, width = index == -1 ? "100%" : (dimensions.widths || [])[index]);
    		}

    		if ($$self.$$.dirty[0] & /*misc*/ 524288) {
    			$$invalidate(24, _refresh = misc.refresh ? " " : "");
    		}

    		if ($$self.$$.dirty[0] & /*dimensions, features*/ 294912) {
    			$$invalidate(25, _style = e => {
    				let s = "overflow-wrap:break-word;box-sizing:content-box;";
    				const whitespace = "white-space: nowrap;overflow:hidden;text-overflow: ellipsis;";
    				const em = (dimensions.row || defaults.dimensions.row) + "px;";
    				s += "padding:" + (dimensions.padding || defaults.dimensions.padding) + "px;";

    				s += features.autohide || dimensions.row
    				? whitespace + "height:" + em + "line-height:" + em
    				: "";

    				return s;
    			});
    		}

    		if ($$self.$$.dirty[0] & /*_style*/ 33554432) {
    			$$invalidate(8, style = _style());
    		}

    		if ($$self.$$.dirty[0] & /*features*/ 262144) {
    			$$invalidate(26, sorting = features?.sortable?.key);
    		}

    		if ($$self.$$.dirty[0] & /*sorting, type, width*/ 75497488) {
    			$$invalidate(9, tdStyle = `
		vertical-align:middle;
		margin:0;
		padding:0;
		position:relative;
		${sorting && type == "key" ? "cursor:pointer" : ""}
		${width
			? `width:${isNaN(width) ? width : width + "px"};`
			: ""}`);
    		}

    		hasSlot = $$props.$$slots;

    		if ($$self.$$.dirty[0] & /*id, item, key, index, type*/ 15728642) {
    			$$invalidate(5, obj = {
    				id,
    				item,
    				key,
    				value: item[key],
    				index,
    				type
    			});
    		}

    		if ($$self.$$.dirty[0] & /*callbacks*/ 131072) {
    			$$invalidate(27, cbs = callbacks || {});
    		}

    		if ($$self.$$.dirty[0] & /*cbs, type*/ 142606336) {
    			$$invalidate(6, renderFunc = (cbs.render || {})[type] || defaults.render);
    		}

    		if ($$self.$$.dirty[0] & /*cbs, type*/ 142606336) {
    			clickFunc = (cbs.click || {})[type] || defaults.click;
    		}

    		if ($$self.$$.dirty[0] & /*features*/ 262144) {
    			$$invalidate(10, direction = features?.sortable?.direction);
    		}

    		if ($$self.$$.dirty[0] & /*sorting, key*/ 67108866) {
    			$$invalidate(11, same = sorting == key);
    		}

    		if ($$self.$$.dirty[0] & /*renderFunc*/ 64) {
    			$$invalidate(7, component = Object.getOwnPropertyNames(renderFunc).indexOf("prototype") != -1);
    		}

    		if ($$self.$$.dirty[0] & /*component, renderFunc, obj, _refresh*/ 16777440) {
    			$$invalidate(12, render = component ? null : (renderFunc(obj) || "") + _refresh);
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		init,
    		key,
    		colspan,
    		class_,
    		width,
    		obj,
    		renderFunc,
    		component,
    		style,
    		tdStyle,
    		direction,
    		same,
    		render,
    		onClick,
    		$$slots,
    		dimensions,
    		debug,
    		callbacks,
    		features,
    		misc,
    		id,
    		item,
    		index,
    		type,
    		_refresh,
    		_style,
    		sorting,
    		cbs,
    		$$scope,
    		slots,
    		click_handler
    	];
    }

    class Td extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$3,
    			create_fragment$3,
    			safe_not_equal,
    			{
    				init: 0,
    				dimensions: 15,
    				debug: 16,
    				callbacks: 17,
    				features: 18,
    				misc: 19,
    				id: 20,
    				item: 21,
    				key: 1,
    				index: 22,
    				type: 23,
    				colspan: 2,
    				class: 3
    			},
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Td",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*init*/ ctx[0] === undefined && !("init" in props)) {
    			console.warn("<Td> was created without expected prop 'init'");
    		}

    		if (/*dimensions*/ ctx[15] === undefined && !("dimensions" in props)) {
    			console.warn("<Td> was created without expected prop 'dimensions'");
    		}

    		if (/*debug*/ ctx[16] === undefined && !("debug" in props)) {
    			console.warn("<Td> was created without expected prop 'debug'");
    		}

    		if (/*callbacks*/ ctx[17] === undefined && !("callbacks" in props)) {
    			console.warn("<Td> was created without expected prop 'callbacks'");
    		}

    		if (/*features*/ ctx[18] === undefined && !("features" in props)) {
    			console.warn("<Td> was created without expected prop 'features'");
    		}

    		if (/*misc*/ ctx[19] === undefined && !("misc" in props)) {
    			console.warn("<Td> was created without expected prop 'misc'");
    		}

    		if (/*id*/ ctx[20] === undefined && !("id" in props)) {
    			console.warn("<Td> was created without expected prop 'id'");
    		}

    		if (/*item*/ ctx[21] === undefined && !("item" in props)) {
    			console.warn("<Td> was created without expected prop 'item'");
    		}

    		if (/*key*/ ctx[1] === undefined && !("key" in props)) {
    			console.warn("<Td> was created without expected prop 'key'");
    		}

    		if (/*index*/ ctx[22] === undefined && !("index" in props)) {
    			console.warn("<Td> was created without expected prop 'index'");
    		}

    		if (/*type*/ ctx[23] === undefined && !("type" in props)) {
    			console.warn("<Td> was created without expected prop 'type'");
    		}
    	}

    	get init() {
    		throw new Error("<Td>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set init(value) {
    		throw new Error("<Td>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dimensions() {
    		throw new Error("<Td>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dimensions(value) {
    		throw new Error("<Td>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get debug() {
    		throw new Error("<Td>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set debug(value) {
    		throw new Error("<Td>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get callbacks() {
    		throw new Error("<Td>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set callbacks(value) {
    		throw new Error("<Td>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get features() {
    		throw new Error("<Td>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set features(value) {
    		throw new Error("<Td>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get misc() {
    		throw new Error("<Td>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set misc(value) {
    		throw new Error("<Td>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Td>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Td>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get item() {
    		throw new Error("<Td>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set item(value) {
    		throw new Error("<Td>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get key() {
    		throw new Error("<Td>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set key(value) {
    		throw new Error("<Td>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get index() {
    		throw new Error("<Td>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set index(value) {
    		throw new Error("<Td>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get type() {
    		throw new Error("<Td>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set type(value) {
    		throw new Error("<Td>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get colspan() {
    		throw new Error("<Td>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set colspan(value) {
    		throw new Error("<Td>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<Td>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Td>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules/.pnpm/svelte-tabular-table@1.0.5/node_modules/svelte-tabular-table/src/Tr.svelte generated by Svelte v3.38.2 */
    const file$2 = "node_modules/.pnpm/svelte-tabular-table@1.0.5/node_modules/svelte-tabular-table/src/Tr.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[23] = list[i];
    	child_ctx[25] = i;
    	return child_ctx;
    }

    // (71:0) {:else}
    function create_else_block$1(ctx) {
    	let tr;
    	let t0;
    	let t1;
    	let tr_class_value;
    	let tr_data_key_value;
    	let current;
    	let if_block0 = /*features*/ ctx[0].checkable && create_if_block_3$1(ctx);
    	let if_block1 = /*features*/ ctx[0].rearrangeable && create_if_block_1$1(ctx);
    	let each_value = /*keys*/ ctx[10];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(tr, "class", tr_class_value = "stt-" + slugify(/*id*/ ctx[9]));
    			attr_dev(tr, "data-key", tr_data_key_value = slugify(/*id*/ ctx[9]));
    			attr_dev(tr, "style", /*style*/ ctx[16]);
    			toggle_class(tr, "stt-checked", /*checked*/ ctx[13]);
    			toggle_class(tr, "stt-rearrangeable", /*features*/ ctx[0].rearrangeable);
    			add_location(tr, file$2, 71, 1, 1613);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			if (if_block0) if_block0.m(tr, null);
    			append_dev(tr, t0);
    			if (if_block1) if_block1.m(tr, null);
    			append_dev(tr, t1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tr, null);
    			}

    			/*tr_binding_1*/ ctx[21](tr);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*features*/ ctx[0].checkable) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*features*/ 1) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_3$1(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(tr, t0);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*features*/ ctx[0].rearrangeable) {
    				if (if_block1) {
    					if_block1.p(ctx, dirty);

    					if (dirty & /*features*/ 1) {
    						transition_in(if_block1, 1);
    					}
    				} else {
    					if_block1 = create_if_block_1$1(ctx);
    					if_block1.c();
    					transition_in(if_block1, 1);
    					if_block1.m(tr, t1);
    				}
    			} else if (if_block1) {
    				group_outros();

    				transition_out(if_block1, 1, 1, () => {
    					if_block1 = null;
    				});

    				check_outros();
    			}

    			if (dirty & /*init, dimensions, debug, callbacks, features, misc, id, item, keys, type, offset*/ 3839) {
    				each_value = /*keys*/ ctx[10];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(tr, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (!current || dirty & /*id*/ 512 && tr_class_value !== (tr_class_value = "stt-" + slugify(/*id*/ ctx[9]))) {
    				attr_dev(tr, "class", tr_class_value);
    			}

    			if (!current || dirty & /*id*/ 512 && tr_data_key_value !== (tr_data_key_value = slugify(/*id*/ ctx[9]))) {
    				attr_dev(tr, "data-key", tr_data_key_value);
    			}

    			if (dirty & /*id, checked*/ 8704) {
    				toggle_class(tr, "stt-checked", /*checked*/ ctx[13]);
    			}

    			if (dirty & /*id, features*/ 513) {
    				toggle_class(tr, "stt-rearrangeable", /*features*/ ctx[0].rearrangeable);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			transition_in(if_block1);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			transition_out(if_block1);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			destroy_each(each_blocks, detaching);
    			/*tr_binding_1*/ ctx[21](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(71:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (57:0) {#if misc.hidden[ id ] || !misc.inited }
    function create_if_block$2(ctx) {
    	let tr;
    	let td;
    	let tr_class_value;
    	let tr_data_key_value;
    	let current;

    	td = new Td({
    			props: {
    				init: /*init*/ ctx[2],
    				dimensions: /*dimensions*/ ctx[3],
    				debug: /*debug*/ ctx[4],
    				callbacks: /*callbacks*/ ctx[5],
    				features: /*features*/ ctx[0],
    				misc: /*misc*/ ctx[1],
    				id: /*id*/ ctx[9],
    				item: /*item*/ ctx[6],
    				type: /*type*/ ctx[7],
    				colspan: /*colspan*/ ctx[12],
    				index: -1,
    				key: "stt-hidden-cell",
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			tr = element("tr");
    			create_component(td.$$.fragment);
    			attr_dev(tr, "class", tr_class_value = "stt-" + slugify(/*id*/ ctx[9]));
    			attr_dev(tr, "data-key", tr_data_key_value = slugify(/*id*/ ctx[9]));
    			attr_dev(tr, "style", /*style*/ ctx[16]);
    			toggle_class(tr, "stt-hidden", true);
    			add_location(tr, file$2, 58, 1, 1269);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			mount_component(td, tr, null);
    			/*tr_binding*/ ctx[18](tr);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const td_changes = {};
    			if (dirty & /*init*/ 4) td_changes.init = /*init*/ ctx[2];
    			if (dirty & /*dimensions*/ 8) td_changes.dimensions = /*dimensions*/ ctx[3];
    			if (dirty & /*debug*/ 16) td_changes.debug = /*debug*/ ctx[4];
    			if (dirty & /*callbacks*/ 32) td_changes.callbacks = /*callbacks*/ ctx[5];
    			if (dirty & /*features*/ 1) td_changes.features = /*features*/ ctx[0];
    			if (dirty & /*misc*/ 2) td_changes.misc = /*misc*/ ctx[1];
    			if (dirty & /*id*/ 512) td_changes.id = /*id*/ ctx[9];
    			if (dirty & /*item*/ 64) td_changes.item = /*item*/ ctx[6];
    			if (dirty & /*type*/ 128) td_changes.type = /*type*/ ctx[7];
    			if (dirty & /*colspan*/ 4096) td_changes.colspan = /*colspan*/ ctx[12];

    			if (dirty & /*$$scope, dimensions*/ 67108872) {
    				td_changes.$$scope = { dirty, ctx };
    			}

    			td.$set(td_changes);

    			if (!current || dirty & /*id*/ 512 && tr_class_value !== (tr_class_value = "stt-" + slugify(/*id*/ ctx[9]))) {
    				attr_dev(tr, "class", tr_class_value);
    			}

    			if (!current || dirty & /*id*/ 512 && tr_data_key_value !== (tr_data_key_value = slugify(/*id*/ ctx[9]))) {
    				attr_dev(tr, "data-key", tr_data_key_value);
    			}

    			if (dirty & /*id*/ 512) {
    				toggle_class(tr, "stt-hidden", true);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(td.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(td.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(tr);
    			destroy_component(td);
    			/*tr_binding*/ ctx[18](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(57:0) {#if misc.hidden[ id ] || !misc.inited }",
    		ctx
    	});

    	return block;
    }

    // (79:2) {#if features.checkable}
    function create_if_block_3$1(ctx) {
    	let td;
    	let current;

    	td = new Td({
    			props: {
    				init: /*init*/ ctx[2],
    				dimensions: /*dimensions*/ ctx[3],
    				debug: /*debug*/ ctx[4],
    				callbacks: /*callbacks*/ ctx[5],
    				features: /*features*/ ctx[0],
    				misc: /*misc*/ ctx[1],
    				id: /*id*/ ctx[9],
    				item: /*item*/ ctx[6],
    				type: /*type*/ ctx[7],
    				index: 0,
    				key: "stt-checkable-cell",
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(td.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(td, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const td_changes = {};
    			if (dirty & /*init*/ 4) td_changes.init = /*init*/ ctx[2];
    			if (dirty & /*dimensions*/ 8) td_changes.dimensions = /*dimensions*/ ctx[3];
    			if (dirty & /*debug*/ 16) td_changes.debug = /*debug*/ ctx[4];
    			if (dirty & /*callbacks*/ 32) td_changes.callbacks = /*callbacks*/ ctx[5];
    			if (dirty & /*features*/ 1) td_changes.features = /*features*/ ctx[0];
    			if (dirty & /*misc*/ 2) td_changes.misc = /*misc*/ ctx[1];
    			if (dirty & /*id*/ 512) td_changes.id = /*id*/ ctx[9];
    			if (dirty & /*item*/ 64) td_changes.item = /*item*/ ctx[6];
    			if (dirty & /*type*/ 128) td_changes.type = /*type*/ ctx[7];

    			if (dirty & /*$$scope, indeterminate, features, id*/ 67109633) {
    				td_changes.$$scope = { dirty, ctx };
    			}

    			td.$set(td_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(td.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(td.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(td, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$1.name,
    		type: "if",
    		source: "(79:2) {#if features.checkable}",
    		ctx
    	});

    	return block;
    }

    // (80:3) <Td {init} {dimensions} {debug} {callbacks} {features} {misc} {id} {item} {type}      index={ 0 }     key={'stt-checkable-cell'}>
    function create_default_slot_2(ctx) {
    	let label;
    	let input;
    	let t;
    	let span;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			label = element("label");
    			input = element("input");
    			t = space();
    			span = element("span");
    			attr_dev(input, "type", "checkbox");
    			input.indeterminate = /*indeterminate*/ ctx[8];
    			add_location(input, file$2, 84, 5, 2002);
    			add_location(span, file$2, 88, 5, 2133);
    			attr_dev(label, "style", /*special*/ ctx[15]);
    			add_location(label, file$2, 82, 4, 1967);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, input);
    			input.checked = /*features*/ ctx[0].checkable[/*id*/ ctx[9]];
    			append_dev(label, t);
    			append_dev(label, span);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", /*input_change_handler*/ ctx[19]),
    					listen_dev(input, "change", /*onChecked*/ ctx[14], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*indeterminate*/ 256) {
    				prop_dev(input, "indeterminate", /*indeterminate*/ ctx[8]);
    			}

    			if (dirty & /*features, id*/ 513) {
    				input.checked = /*features*/ ctx[0].checkable[/*id*/ ctx[9]];
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(80:3) <Td {init} {dimensions} {debug} {callbacks} {features} {misc} {id} {item} {type}      index={ 0 }     key={'stt-checkable-cell'}>",
    		ctx
    	});

    	return block;
    }

    // (94:2) {#if features.rearrangeable}
    function create_if_block_1$1(ctx) {
    	let td;
    	let current;

    	td = new Td({
    			props: {
    				init: /*init*/ ctx[2],
    				dimensions: /*dimensions*/ ctx[3],
    				debug: /*debug*/ ctx[4],
    				callbacks: /*callbacks*/ ctx[5],
    				features: /*features*/ ctx[0],
    				misc: /*misc*/ ctx[1],
    				id: /*id*/ ctx[9],
    				item: /*item*/ ctx[6],
    				type: /*type*/ ctx[7],
    				index: /*offset*/ ctx[11] - 1,
    				key: "stt-rearrangeable-cell",
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(td.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(td, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const td_changes = {};
    			if (dirty & /*init*/ 4) td_changes.init = /*init*/ ctx[2];
    			if (dirty & /*dimensions*/ 8) td_changes.dimensions = /*dimensions*/ ctx[3];
    			if (dirty & /*debug*/ 16) td_changes.debug = /*debug*/ ctx[4];
    			if (dirty & /*callbacks*/ 32) td_changes.callbacks = /*callbacks*/ ctx[5];
    			if (dirty & /*features*/ 1) td_changes.features = /*features*/ ctx[0];
    			if (dirty & /*misc*/ 2) td_changes.misc = /*misc*/ ctx[1];
    			if (dirty & /*id*/ 512) td_changes.id = /*id*/ ctx[9];
    			if (dirty & /*item*/ 64) td_changes.item = /*item*/ ctx[6];
    			if (dirty & /*type*/ 128) td_changes.type = /*type*/ ctx[7];
    			if (dirty & /*offset*/ 2048) td_changes.index = /*offset*/ ctx[11] - 1;

    			if (dirty & /*$$scope, misc, id, type*/ 67109506) {
    				td_changes.$$scope = { dirty, ctx };
    			}

    			td.$set(td_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(td.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(td.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(td, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(94:2) {#if features.rearrangeable}",
    		ctx
    	});

    	return block;
    }

    // (98:4) {#if type != 'key'}
    function create_if_block_2$1(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text("|||");
    			attr_dev(div, "style", /*special*/ ctx[15]);
    			add_location(div, file$2, 98, 5, 2378);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    			/*div_binding*/ ctx[20](div);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[20](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(98:4) {#if type != 'key'}",
    		ctx
    	});

    	return block;
    }

    // (95:3) <Td {init} {dimensions} {debug} {callbacks} {features} {misc} {id} {item} {type}     index={ offset - 1 }     key={'stt-rearrangeable-cell'}>
    function create_default_slot_1(ctx) {
    	let if_block_anchor;
    	let if_block = /*type*/ ctx[7] != "key" && create_if_block_2$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*type*/ ctx[7] != "key") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_2$1(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(95:3) <Td {init} {dimensions} {debug} {callbacks} {features} {misc} {id} {item} {type}     index={ offset - 1 }     key={'stt-rearrangeable-cell'}>",
    		ctx
    	});

    	return block;
    }

    // (104:2) {#each keys as key, idx}
    function create_each_block$2(ctx) {
    	let td;
    	let current;

    	td = new Td({
    			props: {
    				init: /*init*/ ctx[2],
    				dimensions: /*dimensions*/ ctx[3],
    				debug: /*debug*/ ctx[4],
    				callbacks: /*callbacks*/ ctx[5],
    				features: /*features*/ ctx[0],
    				misc: /*misc*/ ctx[1],
    				id: /*id*/ ctx[9],
    				item: /*item*/ ctx[6],
    				key: /*key*/ ctx[23],
    				type: /*type*/ ctx[7],
    				index: /*offset*/ ctx[11] + /*idx*/ ctx[25]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(td.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(td, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const td_changes = {};
    			if (dirty & /*init*/ 4) td_changes.init = /*init*/ ctx[2];
    			if (dirty & /*dimensions*/ 8) td_changes.dimensions = /*dimensions*/ ctx[3];
    			if (dirty & /*debug*/ 16) td_changes.debug = /*debug*/ ctx[4];
    			if (dirty & /*callbacks*/ 32) td_changes.callbacks = /*callbacks*/ ctx[5];
    			if (dirty & /*features*/ 1) td_changes.features = /*features*/ ctx[0];
    			if (dirty & /*misc*/ 2) td_changes.misc = /*misc*/ ctx[1];
    			if (dirty & /*id*/ 512) td_changes.id = /*id*/ ctx[9];
    			if (dirty & /*item*/ 64) td_changes.item = /*item*/ ctx[6];
    			if (dirty & /*keys*/ 1024) td_changes.key = /*key*/ ctx[23];
    			if (dirty & /*type*/ 128) td_changes.type = /*type*/ ctx[7];
    			if (dirty & /*offset*/ 2048) td_changes.index = /*offset*/ ctx[11] + /*idx*/ ctx[25];
    			td.$set(td_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(td.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(td.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(td, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(104:2) {#each keys as key, idx}",
    		ctx
    	});

    	return block;
    }

    // (64:2) <Td {init} {dimensions} {debug} {callbacks} {features} {misc} {id} {item} {type} {colspan}    index={ -1 }    key={'stt-hidden-cell'}>
    function create_default_slot(ctx) {
    	let div;
    	let div_style_value;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "style", div_style_value = `height: ${/*dimensions*/ ctx[3].row}px`);
    			add_location(div, file$2, 66, 3, 1542);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*dimensions*/ 8 && div_style_value !== (div_style_value = `height: ${/*dimensions*/ ctx[3].row}px`)) {
    				attr_dev(div, "style", div_style_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(64:2) <Td {init} {dimensions} {debug} {callbacks} {features} {misc} {id} {item} {type} {colspan}    index={ -1 }    key={'stt-hidden-cell'}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$2, create_else_block$1];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*misc*/ ctx[1].hidden[/*id*/ ctx[9]] || !/*misc*/ ctx[1].inited) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let id;
    	let total;
    	let offset;
    	let colspan;
    	let keys;
    	let checked;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Tr", slots, []);
    	let { init } = $$props;
    	let { dimensions } = $$props;
    	let { debug } = $$props;
    	let { callbacks } = $$props;
    	let { features } = $$props;
    	let { misc } = $$props;
    	let { item } = $$props;
    	let { type } = $$props; // ie. cell or thead
    	let { indeterminate = false } = $$props;

    	function onChecked(event) {
    		if (type == "key") {
    			for (let i = 0; i < init.data.length; i++) {
    				const id = init.data[i][init.index];
    				$$invalidate(0, features.checkable[id] = event.target.checked, features);
    			}
    		} else {
    			(callbacks?.checked || defaults.checked)({ item, id, event });
    			$$invalidate(0, features.checkable[id] = event.target.checked, features);
    		}
    	}

    	const special = `
		cursor:pointer;
		position:absolute;
		top:0;
		left:0;
		width:100%;
		height:100%;
		display:flex;
		box-sizing: border-box;
		padding: ${dimensions.padding || defaults.dimensions.padding}px;
		align-items:center;`;

    	const _total = e => init.keys.length + (features.checkable ? 1 : 0) + (features.rearrangeable ? 1 : 0);
    	let style = "";

    	const writable_props = [
    		"init",
    		"dimensions",
    		"debug",
    		"callbacks",
    		"features",
    		"misc",
    		"item",
    		"type",
    		"indeterminate"
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Tr> was created with unknown prop '${key}'`);
    	});

    	function tr_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			misc.els.tr[id] = $$value;
    			$$invalidate(1, misc);
    			(($$invalidate(9, id), $$invalidate(6, item)), $$invalidate(2, init));
    		});
    	}

    	function input_change_handler() {
    		features.checkable[id] = this.checked;
    		$$invalidate(0, features);
    		(($$invalidate(9, id), $$invalidate(6, item)), $$invalidate(2, init));
    	}

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			misc.els.handles[id] = $$value;
    			$$invalidate(1, misc);
    			(($$invalidate(9, id), $$invalidate(6, item)), $$invalidate(2, init));
    		});
    	}

    	function tr_binding_1($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			misc.els.tr[id] = $$value;
    			$$invalidate(1, misc);
    			(($$invalidate(9, id), $$invalidate(6, item)), $$invalidate(2, init));
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("init" in $$props) $$invalidate(2, init = $$props.init);
    		if ("dimensions" in $$props) $$invalidate(3, dimensions = $$props.dimensions);
    		if ("debug" in $$props) $$invalidate(4, debug = $$props.debug);
    		if ("callbacks" in $$props) $$invalidate(5, callbacks = $$props.callbacks);
    		if ("features" in $$props) $$invalidate(0, features = $$props.features);
    		if ("misc" in $$props) $$invalidate(1, misc = $$props.misc);
    		if ("item" in $$props) $$invalidate(6, item = $$props.item);
    		if ("type" in $$props) $$invalidate(7, type = $$props.type);
    		if ("indeterminate" in $$props) $$invalidate(8, indeterminate = $$props.indeterminate);
    	};

    	$$self.$capture_state = () => ({
    		Td,
    		defaults,
    		slugify,
    		init,
    		dimensions,
    		debug,
    		callbacks,
    		features,
    		misc,
    		item,
    		type,
    		indeterminate,
    		onChecked,
    		special,
    		_total,
    		style,
    		id,
    		total,
    		offset,
    		keys,
    		colspan,
    		checked
    	});

    	$$self.$inject_state = $$props => {
    		if ("init" in $$props) $$invalidate(2, init = $$props.init);
    		if ("dimensions" in $$props) $$invalidate(3, dimensions = $$props.dimensions);
    		if ("debug" in $$props) $$invalidate(4, debug = $$props.debug);
    		if ("callbacks" in $$props) $$invalidate(5, callbacks = $$props.callbacks);
    		if ("features" in $$props) $$invalidate(0, features = $$props.features);
    		if ("misc" in $$props) $$invalidate(1, misc = $$props.misc);
    		if ("item" in $$props) $$invalidate(6, item = $$props.item);
    		if ("type" in $$props) $$invalidate(7, type = $$props.type);
    		if ("indeterminate" in $$props) $$invalidate(8, indeterminate = $$props.indeterminate);
    		if ("style" in $$props) $$invalidate(16, style = $$props.style);
    		if ("id" in $$props) $$invalidate(9, id = $$props.id);
    		if ("total" in $$props) $$invalidate(17, total = $$props.total);
    		if ("offset" in $$props) $$invalidate(11, offset = $$props.offset);
    		if ("keys" in $$props) $$invalidate(10, keys = $$props.keys);
    		if ("colspan" in $$props) $$invalidate(12, colspan = $$props.colspan);
    		if ("checked" in $$props) $$invalidate(13, checked = $$props.checked);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*item, init*/ 68) {
    			$$invalidate(9, id = item[init?.index] || init.data.indexOf(item));
    		}

    		if ($$self.$$.dirty & /*init*/ 4) {
    			$$invalidate(10, keys = init.keys || []);
    		}

    		if ($$self.$$.dirty & /*total, keys*/ 132096) {
    			$$invalidate(11, offset = total - keys.length);
    		}

    		if ($$self.$$.dirty & /*total*/ 131072) {
    			$$invalidate(12, colspan = total);
    		}

    		if ($$self.$$.dirty & /*features, id*/ 513) {
    			$$invalidate(13, checked = (features?.checkable || {})[id]);
    		}
    	};

    	$$invalidate(17, total = _total());

    	return [
    		features,
    		misc,
    		init,
    		dimensions,
    		debug,
    		callbacks,
    		item,
    		type,
    		indeterminate,
    		id,
    		keys,
    		offset,
    		colspan,
    		checked,
    		onChecked,
    		special,
    		style,
    		total,
    		tr_binding,
    		input_change_handler,
    		div_binding,
    		tr_binding_1
    	];
    }

    class Tr extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {
    			init: 2,
    			dimensions: 3,
    			debug: 4,
    			callbacks: 5,
    			features: 0,
    			misc: 1,
    			item: 6,
    			type: 7,
    			indeterminate: 8
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tr",
    			options,
    			id: create_fragment$2.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*init*/ ctx[2] === undefined && !("init" in props)) {
    			console.warn("<Tr> was created without expected prop 'init'");
    		}

    		if (/*dimensions*/ ctx[3] === undefined && !("dimensions" in props)) {
    			console.warn("<Tr> was created without expected prop 'dimensions'");
    		}

    		if (/*debug*/ ctx[4] === undefined && !("debug" in props)) {
    			console.warn("<Tr> was created without expected prop 'debug'");
    		}

    		if (/*callbacks*/ ctx[5] === undefined && !("callbacks" in props)) {
    			console.warn("<Tr> was created without expected prop 'callbacks'");
    		}

    		if (/*features*/ ctx[0] === undefined && !("features" in props)) {
    			console.warn("<Tr> was created without expected prop 'features'");
    		}

    		if (/*misc*/ ctx[1] === undefined && !("misc" in props)) {
    			console.warn("<Tr> was created without expected prop 'misc'");
    		}

    		if (/*item*/ ctx[6] === undefined && !("item" in props)) {
    			console.warn("<Tr> was created without expected prop 'item'");
    		}

    		if (/*type*/ ctx[7] === undefined && !("type" in props)) {
    			console.warn("<Tr> was created without expected prop 'type'");
    		}
    	}

    	get init() {
    		throw new Error("<Tr>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set init(value) {
    		throw new Error("<Tr>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dimensions() {
    		throw new Error("<Tr>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dimensions(value) {
    		throw new Error("<Tr>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get debug() {
    		throw new Error("<Tr>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set debug(value) {
    		throw new Error("<Tr>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get callbacks() {
    		throw new Error("<Tr>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set callbacks(value) {
    		throw new Error("<Tr>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get features() {
    		throw new Error("<Tr>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set features(value) {
    		throw new Error("<Tr>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get misc() {
    		throw new Error("<Tr>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set misc(value) {
    		throw new Error("<Tr>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get item() {
    		throw new Error("<Tr>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set item(value) {
    		throw new Error("<Tr>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get type() {
    		throw new Error("<Tr>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set type(value) {
    		throw new Error("<Tr>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get indeterminate() {
    		throw new Error("<Tr>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set indeterminate(value) {
    		throw new Error("<Tr>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    function createCommonjsModule(fn, basedir, module) {
    	return module = {
    		path: basedir,
    		exports: {},
    		require: function (path, base) {
    			return commonjsRequire(path, (base === undefined || base === null) ? module.path : base);
    		}
    	}, fn(module, module.exports), module.exports;
    }

    function commonjsRequire () {
    	throw new Error('Dynamic requires are not currently supported by @rollup/plugin-commonjs');
    }

    var strictUriEncode = str => encodeURIComponent(str).replace(/[!'()*]/g, x => `%${x.charCodeAt(0).toString(16).toUpperCase()}`);

    var token = '%[a-f0-9]{2}';
    var singleMatcher = new RegExp(token, 'gi');
    var multiMatcher = new RegExp('(' + token + ')+', 'gi');

    function decodeComponents(components, split) {
    	try {
    		// Try to decode the entire string first
    		return decodeURIComponent(components.join(''));
    	} catch (err) {
    		// Do nothing
    	}

    	if (components.length === 1) {
    		return components;
    	}

    	split = split || 1;

    	// Split the array in 2 parts
    	var left = components.slice(0, split);
    	var right = components.slice(split);

    	return Array.prototype.concat.call([], decodeComponents(left), decodeComponents(right));
    }

    function decode(input) {
    	try {
    		return decodeURIComponent(input);
    	} catch (err) {
    		var tokens = input.match(singleMatcher);

    		for (var i = 1; i < tokens.length; i++) {
    			input = decodeComponents(tokens, i).join('');

    			tokens = input.match(singleMatcher);
    		}

    		return input;
    	}
    }

    function customDecodeURIComponent(input) {
    	// Keep track of all the replacements and prefill the map with the `BOM`
    	var replaceMap = {
    		'%FE%FF': '\uFFFD\uFFFD',
    		'%FF%FE': '\uFFFD\uFFFD'
    	};

    	var match = multiMatcher.exec(input);
    	while (match) {
    		try {
    			// Decode as big chunks as possible
    			replaceMap[match[0]] = decodeURIComponent(match[0]);
    		} catch (err) {
    			var result = decode(match[0]);

    			if (result !== match[0]) {
    				replaceMap[match[0]] = result;
    			}
    		}

    		match = multiMatcher.exec(input);
    	}

    	// Add `%C2` at the end of the map to make sure it does not replace the combinator before everything else
    	replaceMap['%C2'] = '\uFFFD';

    	var entries = Object.keys(replaceMap);

    	for (var i = 0; i < entries.length; i++) {
    		// Replace all decoded components
    		var key = entries[i];
    		input = input.replace(new RegExp(key, 'g'), replaceMap[key]);
    	}

    	return input;
    }

    var decodeUriComponent = function (encodedURI) {
    	if (typeof encodedURI !== 'string') {
    		throw new TypeError('Expected `encodedURI` to be of type `string`, got `' + typeof encodedURI + '`');
    	}

    	try {
    		encodedURI = encodedURI.replace(/\+/g, ' ');

    		// Try the built in decoder first
    		return decodeURIComponent(encodedURI);
    	} catch (err) {
    		// Fallback to a more advanced decoder
    		return customDecodeURIComponent(encodedURI);
    	}
    };

    var splitOnFirst = (string, separator) => {
    	if (!(typeof string === 'string' && typeof separator === 'string')) {
    		throw new TypeError('Expected the arguments to be of type `string`');
    	}

    	if (separator === '') {
    		return [string];
    	}

    	const separatorIndex = string.indexOf(separator);

    	if (separatorIndex === -1) {
    		return [string];
    	}

    	return [
    		string.slice(0, separatorIndex),
    		string.slice(separatorIndex + separator.length)
    	];
    };

    var filterObj = function (obj, predicate) {
    	var ret = {};
    	var keys = Object.keys(obj);
    	var isArr = Array.isArray(predicate);

    	for (var i = 0; i < keys.length; i++) {
    		var key = keys[i];
    		var val = obj[key];

    		if (isArr ? predicate.indexOf(key) !== -1 : predicate(key, val, obj)) {
    			ret[key] = val;
    		}
    	}

    	return ret;
    };

    var queryString = createCommonjsModule(function (module, exports) {





    const isNullOrUndefined = value => value === null || value === undefined;

    function encoderForArrayFormat(options) {
    	switch (options.arrayFormat) {
    		case 'index':
    			return key => (result, value) => {
    				const index = result.length;

    				if (
    					value === undefined ||
    					(options.skipNull && value === null) ||
    					(options.skipEmptyString && value === '')
    				) {
    					return result;
    				}

    				if (value === null) {
    					return [...result, [encode(key, options), '[', index, ']'].join('')];
    				}

    				return [
    					...result,
    					[encode(key, options), '[', encode(index, options), ']=', encode(value, options)].join('')
    				];
    			};

    		case 'bracket':
    			return key => (result, value) => {
    				if (
    					value === undefined ||
    					(options.skipNull && value === null) ||
    					(options.skipEmptyString && value === '')
    				) {
    					return result;
    				}

    				if (value === null) {
    					return [...result, [encode(key, options), '[]'].join('')];
    				}

    				return [...result, [encode(key, options), '[]=', encode(value, options)].join('')];
    			};

    		case 'comma':
    		case 'separator':
    		case 'bracket-separator': {
    			const keyValueSep = options.arrayFormat === 'bracket-separator' ?
    				'[]=' :
    				'=';

    			return key => (result, value) => {
    				if (
    					value === undefined ||
    					(options.skipNull && value === null) ||
    					(options.skipEmptyString && value === '')
    				) {
    					return result;
    				}

    				// Translate null to an empty string so that it doesn't serialize as 'null'
    				value = value === null ? '' : value;

    				if (result.length === 0) {
    					return [[encode(key, options), keyValueSep, encode(value, options)].join('')];
    				}

    				return [[result, encode(value, options)].join(options.arrayFormatSeparator)];
    			};
    		}

    		default:
    			return key => (result, value) => {
    				if (
    					value === undefined ||
    					(options.skipNull && value === null) ||
    					(options.skipEmptyString && value === '')
    				) {
    					return result;
    				}

    				if (value === null) {
    					return [...result, encode(key, options)];
    				}

    				return [...result, [encode(key, options), '=', encode(value, options)].join('')];
    			};
    	}
    }

    function parserForArrayFormat(options) {
    	let result;

    	switch (options.arrayFormat) {
    		case 'index':
    			return (key, value, accumulator) => {
    				result = /\[(\d*)\]$/.exec(key);

    				key = key.replace(/\[\d*\]$/, '');

    				if (!result) {
    					accumulator[key] = value;
    					return;
    				}

    				if (accumulator[key] === undefined) {
    					accumulator[key] = {};
    				}

    				accumulator[key][result[1]] = value;
    			};

    		case 'bracket':
    			return (key, value, accumulator) => {
    				result = /(\[\])$/.exec(key);
    				key = key.replace(/\[\]$/, '');

    				if (!result) {
    					accumulator[key] = value;
    					return;
    				}

    				if (accumulator[key] === undefined) {
    					accumulator[key] = [value];
    					return;
    				}

    				accumulator[key] = [].concat(accumulator[key], value);
    			};

    		case 'comma':
    		case 'separator':
    			return (key, value, accumulator) => {
    				const isArray = typeof value === 'string' && value.includes(options.arrayFormatSeparator);
    				const isEncodedArray = (typeof value === 'string' && !isArray && decode(value, options).includes(options.arrayFormatSeparator));
    				value = isEncodedArray ? decode(value, options) : value;
    				const newValue = isArray || isEncodedArray ? value.split(options.arrayFormatSeparator).map(item => decode(item, options)) : value === null ? value : decode(value, options);
    				accumulator[key] = newValue;
    			};

    		case 'bracket-separator':
    			return (key, value, accumulator) => {
    				const isArray = /(\[\])$/.test(key);
    				key = key.replace(/\[\]$/, '');

    				if (!isArray) {
    					accumulator[key] = value ? decode(value, options) : value;
    					return;
    				}

    				const arrayValue = value === null ?
    					[] :
    					value.split(options.arrayFormatSeparator).map(item => decode(item, options));

    				if (accumulator[key] === undefined) {
    					accumulator[key] = arrayValue;
    					return;
    				}

    				accumulator[key] = [].concat(accumulator[key], arrayValue);
    			};

    		default:
    			return (key, value, accumulator) => {
    				if (accumulator[key] === undefined) {
    					accumulator[key] = value;
    					return;
    				}

    				accumulator[key] = [].concat(accumulator[key], value);
    			};
    	}
    }

    function validateArrayFormatSeparator(value) {
    	if (typeof value !== 'string' || value.length !== 1) {
    		throw new TypeError('arrayFormatSeparator must be single character string');
    	}
    }

    function encode(value, options) {
    	if (options.encode) {
    		return options.strict ? strictUriEncode(value) : encodeURIComponent(value);
    	}

    	return value;
    }

    function decode(value, options) {
    	if (options.decode) {
    		return decodeUriComponent(value);
    	}

    	return value;
    }

    function keysSorter(input) {
    	if (Array.isArray(input)) {
    		return input.sort();
    	}

    	if (typeof input === 'object') {
    		return keysSorter(Object.keys(input))
    			.sort((a, b) => Number(a) - Number(b))
    			.map(key => input[key]);
    	}

    	return input;
    }

    function removeHash(input) {
    	const hashStart = input.indexOf('#');
    	if (hashStart !== -1) {
    		input = input.slice(0, hashStart);
    	}

    	return input;
    }

    function getHash(url) {
    	let hash = '';
    	const hashStart = url.indexOf('#');
    	if (hashStart !== -1) {
    		hash = url.slice(hashStart);
    	}

    	return hash;
    }

    function extract(input) {
    	input = removeHash(input);
    	const queryStart = input.indexOf('?');
    	if (queryStart === -1) {
    		return '';
    	}

    	return input.slice(queryStart + 1);
    }

    function parseValue(value, options) {
    	if (options.parseNumbers && !Number.isNaN(Number(value)) && (typeof value === 'string' && value.trim() !== '')) {
    		value = Number(value);
    	} else if (options.parseBooleans && value !== null && (value.toLowerCase() === 'true' || value.toLowerCase() === 'false')) {
    		value = value.toLowerCase() === 'true';
    	}

    	return value;
    }

    function parse(query, options) {
    	options = Object.assign({
    		decode: true,
    		sort: true,
    		arrayFormat: 'none',
    		arrayFormatSeparator: ',',
    		parseNumbers: false,
    		parseBooleans: false
    	}, options);

    	validateArrayFormatSeparator(options.arrayFormatSeparator);

    	const formatter = parserForArrayFormat(options);

    	// Create an object with no prototype
    	const ret = Object.create(null);

    	if (typeof query !== 'string') {
    		return ret;
    	}

    	query = query.trim().replace(/^[?#&]/, '');

    	if (!query) {
    		return ret;
    	}

    	for (const param of query.split('&')) {
    		if (param === '') {
    			continue;
    		}

    		let [key, value] = splitOnFirst(options.decode ? param.replace(/\+/g, ' ') : param, '=');

    		// Missing `=` should be `null`:
    		// http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
    		value = value === undefined ? null : ['comma', 'separator', 'bracket-separator'].includes(options.arrayFormat) ? value : decode(value, options);
    		formatter(decode(key, options), value, ret);
    	}

    	for (const key of Object.keys(ret)) {
    		const value = ret[key];
    		if (typeof value === 'object' && value !== null) {
    			for (const k of Object.keys(value)) {
    				value[k] = parseValue(value[k], options);
    			}
    		} else {
    			ret[key] = parseValue(value, options);
    		}
    	}

    	if (options.sort === false) {
    		return ret;
    	}

    	return (options.sort === true ? Object.keys(ret).sort() : Object.keys(ret).sort(options.sort)).reduce((result, key) => {
    		const value = ret[key];
    		if (Boolean(value) && typeof value === 'object' && !Array.isArray(value)) {
    			// Sort object keys, not values
    			result[key] = keysSorter(value);
    		} else {
    			result[key] = value;
    		}

    		return result;
    	}, Object.create(null));
    }

    exports.extract = extract;
    exports.parse = parse;

    exports.stringify = (object, options) => {
    	if (!object) {
    		return '';
    	}

    	options = Object.assign({
    		encode: true,
    		strict: true,
    		arrayFormat: 'none',
    		arrayFormatSeparator: ','
    	}, options);

    	validateArrayFormatSeparator(options.arrayFormatSeparator);

    	const shouldFilter = key => (
    		(options.skipNull && isNullOrUndefined(object[key])) ||
    		(options.skipEmptyString && object[key] === '')
    	);

    	const formatter = encoderForArrayFormat(options);

    	const objectCopy = {};

    	for (const key of Object.keys(object)) {
    		if (!shouldFilter(key)) {
    			objectCopy[key] = object[key];
    		}
    	}

    	const keys = Object.keys(objectCopy);

    	if (options.sort !== false) {
    		keys.sort(options.sort);
    	}

    	return keys.map(key => {
    		const value = object[key];

    		if (value === undefined) {
    			return '';
    		}

    		if (value === null) {
    			return encode(key, options);
    		}

    		if (Array.isArray(value)) {
    			if (value.length === 0 && options.arrayFormat === 'bracket-separator') {
    				return encode(key, options) + '[]';
    			}

    			return value
    				.reduce(formatter(key), [])
    				.join('&');
    		}

    		return encode(key, options) + '=' + encode(value, options);
    	}).filter(x => x.length > 0).join('&');
    };

    exports.parseUrl = (url, options) => {
    	options = Object.assign({
    		decode: true
    	}, options);

    	const [url_, hash] = splitOnFirst(url, '#');

    	return Object.assign(
    		{
    			url: url_.split('?')[0] || '',
    			query: parse(extract(url), options)
    		},
    		options && options.parseFragmentIdentifier && hash ? {fragmentIdentifier: decode(hash, options)} : {}
    	);
    };

    exports.stringifyUrl = (object, options) => {
    	options = Object.assign({
    		encode: true,
    		strict: true
    	}, options);

    	const url = removeHash(object.url).split('?')[0] || '';
    	const queryFromUrl = exports.extract(object.url);
    	const parsedQueryFromUrl = exports.parse(queryFromUrl, {sort: false});

    	const query = Object.assign(parsedQueryFromUrl, object.query);
    	let queryString = exports.stringify(query, options);
    	if (queryString) {
    		queryString = `?${queryString}`;
    	}

    	let hash = getHash(object.url);
    	if (object.fragmentIdentifier) {
    		hash = `#${encode(object.fragmentIdentifier, options)}`;
    	}

    	return `${url}${queryString}${hash}`;
    };

    exports.pick = (input, filter, options) => {
    	options = Object.assign({
    		parseFragmentIdentifier: true
    	}, options);

    	const {url, query, fragmentIdentifier} = exports.parseUrl(input, options);
    	return exports.stringifyUrl({
    		url,
    		query: filterObj(query, filter),
    		fragmentIdentifier
    	}, options);
    };

    exports.exclude = (input, filter, options) => {
    	const exclusionFilter = Array.isArray(filter) ? key => !filter.includes(key) : (key, value) => !filter(key, value);

    	return exports.pick(input, exclusionFilter, options);
    };
    });

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    function dragdrop() {

    	const { subscribe, set, update } = writable({});

    	function findAncestor (el, attr) {
    	    while ((el = el.parentElement) && !el.getAttribute( attr ));
    	    return el
    	}
    	function check( group ) {
    		update( d => {
    			if (!d[group]) d[group] = { handles: new Map(), drops: [], source: null, destination: null, callbacks: new Map(), dragging: false };
    			return d
    		});
    	}
    	const reject = e => {
    		// console.warn('[draggable] no group id provided')
    	};

    	const dropHandlers = {
    		dragover: (e) => {
    			const el = findAncestor(e.target, 'data-group');
    			if (!el) return reject()
    			const group = el.getAttribute('data-group');
    			if (!group) return reject()
    			e.preventDefault();
    			let cb;
    			update( d => {
    				cb = d[group].callbacks.get( el );
    				d[group].destination = el; 
    				return d 
    			});
    			if (cb?.dragover) cb.dragover(e);
    		},
    		dragleave: (e) => {
    			const el = findAncestor(e.target, 'data-group');
    			if (!el) return reject()
    			const group = el.getAttribute('data-group');
    			if (!group) return reject()
    			e.preventDefault();
    			let cb;
    			update( d => { 
    				cb = d[group].callbacks.get( el );
    				d[group].destination = null; 
    				return d 
    			});
    			if (cb?.dragleave) cb.dragleave(e);
    		},
    		drop: (e, t) => {
    			const el = findAncestor(e.target, 'data-group');
    			if (!el) return reject()
    			const group = el.getAttribute('data-group');
    			if (!group) return reject()
    			e.preventDefault();
    			let cb;
    			update( d => { 
    				cb = d[group].callbacks.get( el );
    				if (cb?.drop) cb.drop( { 
    					...e, 
    					source: d[group].source, 
    					destination: d[group].destination 
    				});
    				d[group].destination = null; 
    				return d;
    			});
    		}
    	};
    	
    	function addDropArea( group, drop, callbacks ) {
    		if (!group) return reject()
    		check( group );
    		drop.setAttribute('data-group', group);
    		update( d => {
    			d[group].callbacks.set( drop, callbacks );
    			d[group].drops.push( drop );
    			return d 
    		});
    		for (const [type, method] of Object.entries(dropHandlers)) drop.addEventListener( type, method );
    	}
    	
    	const disable = (e) => {
    		const group = e.target.getAttribute('data-group');
    		if (!group) return reject()
    		update( d => {
    			d[group].dragging = false;
    			d[group].source = e.target;
    			return d 
    		});
    		e.target.setAttribute('draggable', false);
    	};

    	const enable = (e) => {
    		const group = e.target.getAttribute('data-group');
    		if (!group) return reject()
    		let element;
    		update( d => { 
    			d[group].dragging = true;
    			element = d[group].handles.get( e.target );
    			d[group].source = element;
    			return d
    		});
    		element.setAttribute('draggable', true);
    	};
    	
    	function addDragArea( group, handle, element ) {
    		
    		if (!group) return reject()
    		check(group);
    		element.addEventListener('dragend', disable);
    		element.addEventListener('mouseup', disable);
    		element.setAttribute('data-group', group);
    		handle.setAttribute( 'data-group', group);
    		handle.addEventListener('mousedown', enable);
    		
    		update( d => { d[group].handles.set( handle, element ); return d });
    	}

    	function isDragging( group ) {
    		if (!group) return reject()
    		check(group);
    		let b;
    		update( d => { 
    			b = d[group].dragging;
    			return d
    		});
    		return b
    	}
    	
    	function clear( group ) {

    		if (!group) return reject()

    		try {
    			update( d => { 

    				if (!d[group]) return d

    				for (const [handle, element] of Object.entries( d[group].handles)) {
    					handle.removeEventListener( 'mousedown', enable );
    					element.removeEventListener( 'dragend', disable );
    					element.removeEventListener( 'mouseup', disable );
    				}
    				for (let i = 0; i < d[group].drops.length; i++) {
    					const drop = d[group].drops[i];
    					for (const [type, method] of Object.entries(dropHandlers)) {
    						drop.removeEventListener( type, method );
    					}
    				}
    				
    				delete d[group];
    				return d 
    			});
    		} catch(err) {
    			console.error(`[dragdrop] could not clear "${group}":`, err.message);
    		}
    	}
    	
    	return {
    		subscribe,
    		set,
    		update,
    		addDragArea,
    		addDropArea,
    		isDragging,
    		clear
    	}
    }

    var dragdrop$1 = dragdrop();

    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }

    /* node_modules/.pnpm/svelte-tabular-table@1.0.5/node_modules/svelte-tabular-table/src/Table.svelte generated by Svelte v3.38.2 */

    const { Object: Object_1$1, console: console_1$1 } = globals;
    const file$1 = "node_modules/.pnpm/svelte-tabular-table@1.0.5/node_modules/svelte-tabular-table/src/Table.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[30] = list[i];
    	child_ctx[32] = i;
    	return child_ctx;
    }

    // (307:1) {#if !init.nohead}
    function create_if_block$1(ctx) {
    	let thead_1;
    	let tr;
    	let updating_features;
    	let current;

    	function tr_features_binding(value) {
    		/*tr_features_binding*/ ctx[13](value);
    	}

    	let tr_props = {
    		init: /*init*/ ctx[0],
    		dimensions: /*dimensions*/ ctx[1],
    		debug: /*debug*/ ctx[4],
    		callbacks: /*callbacks*/ ctx[6],
    		misc: /*misc*/ ctx[7],
    		item: /*thead*/ ctx[10],
    		type: "key",
    		indeterminate: /*indeterminate*/ ctx[8]
    	};

    	if (/*features*/ ctx[2] !== void 0) {
    		tr_props.features = /*features*/ ctx[2];
    	}

    	tr = new Tr({ props: tr_props, $$inline: true });
    	binding_callbacks.push(() => bind(tr, "features", tr_features_binding));

    	const block = {
    		c: function create() {
    			thead_1 = element("thead");
    			create_component(tr.$$.fragment);
    			add_location(thead_1, file$1, 307, 2, 7902);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, thead_1, anchor);
    			mount_component(tr, thead_1, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const tr_changes = {};
    			if (dirty[0] & /*init*/ 1) tr_changes.init = /*init*/ ctx[0];
    			if (dirty[0] & /*dimensions*/ 2) tr_changes.dimensions = /*dimensions*/ ctx[1];
    			if (dirty[0] & /*debug*/ 16) tr_changes.debug = /*debug*/ ctx[4];
    			if (dirty[0] & /*callbacks*/ 64) tr_changes.callbacks = /*callbacks*/ ctx[6];
    			if (dirty[0] & /*misc*/ 128) tr_changes.misc = /*misc*/ ctx[7];
    			if (dirty[0] & /*thead*/ 1024) tr_changes.item = /*thead*/ ctx[10];
    			if (dirty[0] & /*indeterminate*/ 256) tr_changes.indeterminate = /*indeterminate*/ ctx[8];

    			if (!updating_features && dirty[0] & /*features*/ 4) {
    				updating_features = true;
    				tr_changes.features = /*features*/ ctx[2];
    				add_flush_callback(() => updating_features = false);
    			}

    			tr.$set(tr_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tr.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tr.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(thead_1);
    			destroy_component(tr);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(307:1) {#if !init.nohead}",
    		ctx
    	});

    	return block;
    }

    // (317:2) {#each data as item, idx }
    function create_each_block$1(ctx) {
    	let tr;
    	let updating_features;
    	let current;

    	function tr_features_binding_1(value) {
    		/*tr_features_binding_1*/ ctx[14](value);
    	}

    	let tr_props = {
    		init: /*init*/ ctx[0],
    		dimensions: /*dimensions*/ ctx[1],
    		debug: /*debug*/ ctx[4],
    		callbacks: /*callbacks*/ ctx[6],
    		misc: /*misc*/ ctx[7],
    		item: /*item*/ ctx[30],
    		type: "cell"
    	};

    	if (/*features*/ ctx[2] !== void 0) {
    		tr_props.features = /*features*/ ctx[2];
    	}

    	tr = new Tr({ props: tr_props, $$inline: true });
    	binding_callbacks.push(() => bind(tr, "features", tr_features_binding_1));

    	const block = {
    		c: function create() {
    			create_component(tr.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(tr, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const tr_changes = {};
    			if (dirty[0] & /*init*/ 1) tr_changes.init = /*init*/ ctx[0];
    			if (dirty[0] & /*dimensions*/ 2) tr_changes.dimensions = /*dimensions*/ ctx[1];
    			if (dirty[0] & /*debug*/ 16) tr_changes.debug = /*debug*/ ctx[4];
    			if (dirty[0] & /*callbacks*/ 64) tr_changes.callbacks = /*callbacks*/ ctx[6];
    			if (dirty[0] & /*misc*/ 128) tr_changes.misc = /*misc*/ ctx[7];
    			if (dirty[0] & /*data*/ 512) tr_changes.item = /*item*/ ctx[30];

    			if (!updating_features && dirty[0] & /*features*/ 4) {
    				updating_features = true;
    				tr_changes.features = /*features*/ ctx[2];
    				add_flush_callback(() => updating_features = false);
    			}

    			tr.$set(tr_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tr.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tr.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tr, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(317:2) {#each data as item, idx }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let table;
    	let t;
    	let tbody;
    	let table_id_value;
    	let table_class_value;
    	let table_data_id_value;
    	let current;
    	let if_block = !/*init*/ ctx[0].nohead && create_if_block$1(ctx);
    	let each_value = /*data*/ ctx[9];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			table = element("table");
    			if (if_block) if_block.c();
    			t = space();
    			tbody = element("tbody");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(tbody, file$1, 314, 1, 8056);
    			attr_dev(table, "id", table_id_value = "stt-" + slugify(/*id*/ ctx[5]));
    			attr_dev(table, "class", table_class_value = /*class_*/ ctx[3] + " stt-" + slugify(/*id*/ ctx[5]));
    			attr_dev(table, "data-id", table_data_id_value = slugify(/*id*/ ctx[5]));
    			attr_dev(table, "style", /*allStyles*/ ctx[11]);
    			add_location(table, file$1, 299, 0, 7726);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, table, anchor);
    			if (if_block) if_block.m(table, null);
    			append_dev(table, t);
    			append_dev(table, tbody);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(tbody, null);
    			}

    			/*table_binding*/ ctx[15](table);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (!/*init*/ ctx[0].nohead) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*init*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(table, t);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (dirty[0] & /*init, dimensions, debug, callbacks, misc, data, features*/ 727) {
    				each_value = /*data*/ ctx[9];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(tbody, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (!current || dirty[0] & /*id*/ 32 && table_id_value !== (table_id_value = "stt-" + slugify(/*id*/ ctx[5]))) {
    				attr_dev(table, "id", table_id_value);
    			}

    			if (!current || dirty[0] & /*class_, id*/ 40 && table_class_value !== (table_class_value = /*class_*/ ctx[3] + " stt-" + slugify(/*id*/ ctx[5]))) {
    				attr_dev(table, "class", table_class_value);
    			}

    			if (!current || dirty[0] & /*id*/ 32 && table_data_id_value !== (table_data_id_value = slugify(/*id*/ ctx[5]))) {
    				attr_dev(table, "data-id", table_data_id_value);
    			}

    			if (!current || dirty[0] & /*allStyles*/ 2048) {
    				attr_dev(table, "style", /*allStyles*/ ctx[11]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(table);
    			if (if_block) if_block.d();
    			destroy_each(each_blocks, detaching);
    			/*table_binding*/ ctx[15](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function warn(msg) {
    	console.warn(`[svelte-tabular-table] ${msg}`);
    }

    function error(msg) {
    	console.error(`[svelte-tabular-table] ${msg}`);
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let rev;
    	let thead;
    	let sort;
    	let data;
    	let allStyles;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Table", slots, []);

    	function log(msg) {
    		if (debug) console.log(`[svelte-tabular-table] ${msg} ${id ? "(\"" + id + "\")" : ""}`);
    	}

    	function review(init_, dimensions, callbacks, features, misc) {
    		if (features.autohide && !dimensions.row) warn("features.autohide is set, but no height is set for dimensions.row (defaulting to 1em)");
    		let ids = [];
    		let tally = { added: 0, duped: 0 };
    		const len = init.data.length;

    		for (let i = 0; i < len; i++) {
    			if (!init.data[i][init.index]) {
    				const id = "id" + i;
    				warn(`no property "${init.index}" in data item ${i}, defaulting to "${id}"`);
    				$$invalidate(0, init.data[i][init.index] = id, init);
    				tally.added += 1;
    			}

    			if (ids.indexOf(init.data[i][init.index]) != -1) {
    				$$invalidate(0, init.data[i] = { ...init.data[i] }, init);
    				while (ids.indexOf(init.data[i][init.index]) != -1) $$invalidate(0, init.data[i][init.index] += "_dup", init);
    				tally.duped += 1;
    			}

    			ids.push(init.data[i][init.index]);
    		}

    		const activ = tally.duped > 0 || tally.added > 0;
    		if (activ) warn(`${tally.duped}/${len} duplicate keys amended, ${tally.added}/${len} keys added`);
    		if (!features.autohide) misc.inited = true;
    	}

    	let { class: class_ = "" } = $$props;
    	let { style: style_ = "" } = $$props;

    	let { init = {
    		keys: [], // array of text or array of objects
    		data: [],
    		index: null,
    		nohead: false,
    		nodiv: false
    	} } = $$props;

    	let { dimensions = { ...defaults.dimensions } } = $$props;
    	let { debug = true } = $$props;
    	let { id = "table" } = $$props;

    	onMount(async () => {
    		
    	});

    	let { callbacks = {
    		click: {
    			key: defaults.click,
    			row: defaults.click,
    			cell: defaults.click
    		},
    		render: {
    			key: defaults.render,
    			cell: defaults.render
    		},
    		checked: defaults.checked
    	} } = $$props;

    	let { features = {
    		sortable: {
    			key: null,
    			direction: false,
    			sort: defaults.sort
    		},
    		rearrangeable: null, // <- callback event for rearranging with integer index (from, to) as arguments
    		checkable: null,
    		autohide: null
    	} } = $$props;

    	let misc = {
    		hidden: {},
    		els: {
    			table: null,
    			thead: null,
    			tr: {},
    			td: {},
    			handles: {},
    			drops: {}
    		},
    		inited: false,
    		refresh: true,
    		reorder: o => {
    			features?.sortable?.key;
    			$$invalidate(2, features.sortable.direction = !features.sortable.direction, features);

    			if (o.key) {
    				const d = features.sortable.direction;
    				$$invalidate(2, features.sortable.key = o.key, features);
    				log(`sorting with "${o.key}" -> ${d ? "ascending" : "descending"}`);
    			}
    		}
    	};

    	let hasDragDrop = false;

    	onDestroy(async () => {
    		if (hasDragDrop) dragdrop$1.clear("table");
    	});

    	function bindDragDrop(data) {
    		if (!features.rearrangeable) return;

    		setTimeout(
    			() => {
    				if (hasDragDrop) dragdrop$1.clear("table");

    				for (const [key, tr] of Object.entries(misc.els.tr)) {
    					const handle = misc.els.handles[key];

    					const callbacks = {
    						drop: e => {
    							try {
    								const f = e.source.getAttribute("data-key");
    								const t = e.destination.getAttribute("data-key");
    								const ff = init.data.find(d => d[init.index] == f);
    								const tt = init.data.find(d => d[init.index] == t);
    								const fff = init.data.indexOf(ff);
    								const ttt = init.data.indexOf(tt);
    								log(`dragged from ${fff} to ${ttt}`);

    								if (typeof features.rearrangeable == "function") {
    									features.rearrangeable(fff, ttt);
    								} else {
    									warn(`there is no callback for features.rearrangeable (nothing will happen)`);
    								}
    							} catch(err) {
    								error(`could not drag and drop: ${err.message}`);
    							}
    						},
    						enable: e => isDragging = true,
    						disable: e => isDragging = false
    					};

    					if (handle && tr) {
    						dragdrop$1.addDragArea("table", handle, tr);
    						dragdrop$1.addDropArea("table", tr, callbacks);
    						hasDragDrop = true;
    					}
    				}
    			},
    			1
    		);
    	}

    	let aboveY, belowY, bottomY;

    	function onScroll(init_, autohide, dims) {
    		if (!autohide) return;
    		if (autohide && !dimensions?.row) $$invalidate(1, dimensions.row = defaults.dimensions.row, dimensions);
    		if (autohide && !dimensions?.padding) $$invalidate(1, dimensions.padding = defaults.dimensions.padding, dimensions);

    		let tally = {
    			above: 0,
    			below: 0,
    			first: null,
    			last: null
    		};

    		const len = (data || []).length;
    		const el = autohide?.container;
    		const exists = el != undefined && len > 0;
    		const scroll = autohide?.position || 0;
    		const height = dims.row + dims.padding * 2;
    		const outside = (el?.offsetHeight || window.innerHeight) + height;
    		const extra = outside * (autohide?.buffer || 0);
    		const to = misc?.els?.table?.offsetTop || 0;
    		const eo = el?.offsetTop || 0;
    		const off = to - eo;

    		for (let i = 0; i < len; i++) {
    			const item = data[i];
    			const id = item[init.index];
    			$$invalidate(7, misc.hidden[id] = false, misc);
    			const thead = init.nohead ? 0 : height;
    			const piece = height * i + height + thead;
    			const above = scroll > piece + off + extra;
    			const below = piece + off > scroll + outside + extra;
    			if ((above || below) && exists) $$invalidate(7, misc.hidden[id] = true, misc);

    			if (above) {
    				tally.above += 1;
    				tally.first = i;
    			}

    			if (below) {
    				tally.below += 1;
    				if (!tally.last) tally.last = i;
    			}
    		}

    		const activ = tally.above > 0 || tally.below > 0;
    		const indicators = false;

    		if (debug && activ && indicators) {
    			if (!aboveY) {
    				aboveY = document.createElement("div");
    				document.body.appendChild(aboveY);
    				belowY = document.createElement("div");
    				document.body.appendChild(belowY);
    				bottomY = document.createElement("div");
    				document.body.appendChild(bottomY);
    			}

    			const all = `
				position: absolute;
				width: 100vw;
				height: 1px;
				background: red;
				display: block;
				left: 0px;`;

    			aboveY.style = `
				${all}
				top: ${eo - scroll}px;`;

    			belowY.style = `
				${all}
				top: ${to - scroll}px;`;

    			bottomY.style = `
				${all}
				top: ${to - scroll + (misc?.els?.table?.offsetHeight || 0)}px;`;
    		}

    		if (exists) log(`${outside}px container: ${tally.above}/${len} above, ${tally.below}/${len} below, from ${tally.first} to ${tally.last}, ${len - (tally.above + tally.below)}/${len} visible, using height ${height}px`);
    		if (exists) $$invalidate(7, misc.inited = true, misc);
    	}

    	const triggerScroll = e => onScroll(init, features?.autohide, dimensions);

    	function _thead() {
    		return init.keys.reduce(
    			function (result, item, index) {
    				result[item] = item;
    				return result;
    			},
    			{
    				[init.index]: "svelte-tabular-table-thead"
    			}
    		);
    	}

    	let indeterminate = false;

    	function isIndeterminate(checkable) {
    		let yes = false;
    		let no = false;

    		for (let i = 0; i < init.data.length; i++) {
    			const id = init.data[i][init.index];
    			if ((features.checkable || [])[id]) yes = true;
    			if (!(features.checkable || [])[id]) no = true;
    		}

    		if (!yes && no) return $$invalidate(8, indeterminate = false);
    		if (yes && !no) return $$invalidate(8, indeterminate = false);
    		return $$invalidate(8, indeterminate = true);
    	}

    	function getSorted(_sortable, _id) {
    		const s = sort(_sortable, [...init.data], _id);
    		setTimeout(triggerScroll, 1);
    		return s;
    	}

    	const writable_props = ["class", "style", "init", "dimensions", "debug", "id", "callbacks", "features"];

    	Object_1$1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1$1.warn(`<Table> was created with unknown prop '${key}'`);
    	});

    	function tr_features_binding(value) {
    		features = value;
    		$$invalidate(2, features);
    	}

    	function tr_features_binding_1(value) {
    		features = value;
    		$$invalidate(2, features);
    	}

    	function table_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			misc.els.table = $$value;
    			$$invalidate(7, misc);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("class" in $$props) $$invalidate(3, class_ = $$props.class);
    		if ("style" in $$props) $$invalidate(12, style_ = $$props.style);
    		if ("init" in $$props) $$invalidate(0, init = $$props.init);
    		if ("dimensions" in $$props) $$invalidate(1, dimensions = $$props.dimensions);
    		if ("debug" in $$props) $$invalidate(4, debug = $$props.debug);
    		if ("id" in $$props) $$invalidate(5, id = $$props.id);
    		if ("callbacks" in $$props) $$invalidate(6, callbacks = $$props.callbacks);
    		if ("features" in $$props) $$invalidate(2, features = $$props.features);
    	};

    	$$self.$capture_state = () => ({
    		Tr,
    		onMount,
    		onDestroy,
    		queryString,
    		dragdrop: dragdrop$1,
    		fade,
    		defaults,
    		slugify,
    		warn,
    		log,
    		error,
    		review,
    		class_,
    		style_,
    		init,
    		dimensions,
    		debug,
    		id,
    		callbacks,
    		features,
    		misc,
    		hasDragDrop,
    		bindDragDrop,
    		aboveY,
    		belowY,
    		bottomY,
    		onScroll,
    		triggerScroll,
    		_thead,
    		indeterminate,
    		isIndeterminate,
    		getSorted,
    		rev,
    		data,
    		thead,
    		sort,
    		allStyles
    	});

    	$$self.$inject_state = $$props => {
    		if ("class_" in $$props) $$invalidate(3, class_ = $$props.class_);
    		if ("style_" in $$props) $$invalidate(12, style_ = $$props.style_);
    		if ("init" in $$props) $$invalidate(0, init = $$props.init);
    		if ("dimensions" in $$props) $$invalidate(1, dimensions = $$props.dimensions);
    		if ("debug" in $$props) $$invalidate(4, debug = $$props.debug);
    		if ("id" in $$props) $$invalidate(5, id = $$props.id);
    		if ("callbacks" in $$props) $$invalidate(6, callbacks = $$props.callbacks);
    		if ("features" in $$props) $$invalidate(2, features = $$props.features);
    		if ("misc" in $$props) $$invalidate(7, misc = $$props.misc);
    		if ("hasDragDrop" in $$props) hasDragDrop = $$props.hasDragDrop;
    		if ("aboveY" in $$props) aboveY = $$props.aboveY;
    		if ("belowY" in $$props) belowY = $$props.belowY;
    		if ("bottomY" in $$props) bottomY = $$props.bottomY;
    		if ("indeterminate" in $$props) $$invalidate(8, indeterminate = $$props.indeterminate);
    		if ("rev" in $$props) rev = $$props.rev;
    		if ("data" in $$props) $$invalidate(9, data = $$props.data);
    		if ("thead" in $$props) $$invalidate(10, thead = $$props.thead);
    		if ("sort" in $$props) sort = $$props.sort;
    		if ("allStyles" in $$props) $$invalidate(11, allStyles = $$props.allStyles);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*init, dimensions, callbacks, features, misc*/ 199) {
    			rev = review(init, dimensions, callbacks, features, misc);
    		}

    		if ($$self.$$.dirty[0] & /*init, features, dimensions*/ 7) {
    			onScroll(init, features?.autohide, dimensions);
    		}

    		if ($$self.$$.dirty[0] & /*init*/ 1) {
    			bindDragDrop(init.data);
    		}

    		if ($$self.$$.dirty[0] & /*features*/ 4) {
    			isIndeterminate(features.checkable);
    		}

    		if ($$self.$$.dirty[0] & /*features*/ 4) {
    			sort = features?.sortable?.sort || defaults.sort;
    		}

    		if ($$self.$$.dirty[0] & /*features, id, init*/ 37) {
    			$$invalidate(9, data = (features?.sortable?.key)
    			? getSorted(features.sortable, id)
    			: init.data);
    		}

    		if ($$self.$$.dirty[0] & /*dimensions, style_*/ 4098) {
    			$$invalidate(11, allStyles = `min-width:${dimensions.minwidth || "0"}px;width:100%;table-layout:fixed;border-spacing:0;${style_}`);
    		}
    	};

    	$$invalidate(10, thead = _thead());

    	return [
    		init,
    		dimensions,
    		features,
    		class_,
    		debug,
    		id,
    		callbacks,
    		misc,
    		indeterminate,
    		data,
    		thead,
    		allStyles,
    		style_,
    		tr_features_binding,
    		tr_features_binding_1,
    		table_binding
    	];
    }

    class Table extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$1,
    			create_fragment$1,
    			safe_not_equal,
    			{
    				class: 3,
    				style: 12,
    				init: 0,
    				dimensions: 1,
    				debug: 4,
    				id: 5,
    				callbacks: 6,
    				features: 2
    			},
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Table",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get class() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get init() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set init(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get dimensions() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set dimensions(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get debug() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set debug(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get callbacks() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set callbacks(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get features() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set features(value) {
    		throw new Error("<Table>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const SEP = '/';
    // Types ~> static, param, any, optional
    const STYPE=0, PTYPE=1, ATYPE=2, OTYPE=3;
    // Char Codes ~> / : *
    const SLASH=47, COLON=58, ASTER=42, QMARK=63;

    function strip(str) {
    	if (str === SEP) return str;
    	(str.charCodeAt(0) === SLASH) && (str=str.substring(1));
    	var len = str.length - 1;
    	return str.charCodeAt(len) === SLASH ? str.substring(0, len) : str;
    }

    function parse(str) {
    	if (str === SEP) {
    		return [{ old:str, type:STYPE, val:str, end:'' }];
    	}

    	var c, x, t, sfx, nxt=strip(str), i=-1, j=0, len=nxt.length, out=[];

    	while (++i < len) {
    		c = nxt.charCodeAt(i);

    		if (c === COLON) {
    			j = i + 1; // begining of param
    			t = PTYPE; // set type
    			x = 0; // reset mark
    			sfx = '';

    			while (i < len && nxt.charCodeAt(i) !== SLASH) {
    				c = nxt.charCodeAt(i);
    				if (c === QMARK) {
    					x=i; t=OTYPE;
    				} else if (c === 46 && sfx.length === 0) {
    					sfx = nxt.substring(x=i);
    				}
    				i++; // move on
    			}

    			out.push({
    				old: str,
    				type: t,
    				val: nxt.substring(j, x||i),
    				end: sfx
    			});

    			// shorten string & update pointers
    			nxt=nxt.substring(i); len-=i; i=0;

    			continue; // loop
    		} else if (c === ASTER) {
    			out.push({
    				old: str,
    				type: ATYPE,
    				val: nxt.substring(i),
    				end: ''
    			});
    			continue; // loop
    		} else {
    			j = i;
    			while (i < len && nxt.charCodeAt(i) !== SLASH) {
    				++i; // skip to next slash
    			}
    			out.push({
    				old: str,
    				type: STYPE,
    				val: nxt.substring(j, i),
    				end: ''
    			});
    			// shorten string & update pointers
    			nxt=nxt.substring(i); len-=i; i=j=0;
    		}
    	}

    	return out;
    }

    /* src/Overview.svelte generated by Svelte v3.38.2 */

    const { Object: Object_1, console: console_1, window: window_1 } = globals;
    const file = "src/Overview.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[24] = list[i];
    	child_ctx[25] = list;
    	child_ctx[26] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[27] = list[i][0];
    	child_ctx[28] = list[i][1];
    	child_ctx[29] = list;
    	child_ctx[30] = i;
    	return child_ctx;
    }

    // (192:3) {:else}
    function create_else_block_2(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "No endpoint current.";
    			add_location(div, file, 192, 4, 4876);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(192:3) {:else}",
    		ctx
    	});

    	return block;
    }

    // (128:3) {#if endpoint}
    function create_if_block_1(ctx) {
    	let form;
    	let h40;
    	let t1;
    	let show_if = Object.keys(/*endpoint*/ ctx[7].schema).length == 0;
    	let t2;
    	let t3;
    	let div;
    	let h41;
    	let t5;
    	let p;
    	let t6_value = /*endpoint*/ ctx[7].description + "";
    	let t6;
    	let t7;
    	let t8;
    	let input;
    	let t9;
    	let button;
    	let t10;
    	let mounted;
    	let dispose;
    	let if_block = show_if && create_if_block_5(ctx);
    	let each_value_1 = Object.entries(/*endpoint*/ ctx[7].schema);
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	let each_value = /*components*/ ctx[2];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			form = element("form");
    			h40 = element("h4");
    			h40.textContent = "Arguments";
    			t1 = space();
    			if (if_block) if_block.c();
    			t2 = space();

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t3 = space();
    			div = element("div");
    			h41 = element("h4");
    			h41.textContent = "Endpoint";
    			t5 = space();
    			p = element("p");
    			t6 = text(t6_value);
    			t7 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t8 = space();
    			input = element("input");
    			t9 = space();
    			button = element("button");
    			t10 = text("Send");
    			attr_dev(h40, "class", "bold");
    			add_location(h40, file, 129, 5, 3242);
    			attr_dev(form, "class", "flex column cmb1 p1");
    			add_location(form, file, 128, 4, 3202);
    			attr_dev(h41, "class", "bold");
    			add_location(h41, file, 168, 5, 4334);
    			add_location(p, file, 169, 5, 4370);
    			attr_dev(input, "type", "text");
    			input.disabled = true;
    			input.value = /*path*/ ctx[8];
    			add_location(input, file, 183, 5, 4686);
    			attr_dev(button, "class", "filled");
    			button.disabled = /*waiting*/ ctx[5];
    			add_location(button, file, 184, 5, 4742);
    			attr_dev(div, "class", "flex column cmb1 p1 bt1-solid");
    			add_location(div, file, 167, 4, 4285);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			append_dev(form, h40);
    			append_dev(form, t1);
    			if (if_block) if_block.m(form, null);
    			append_dev(form, t2);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(form, null);
    			}

    			insert_dev(target, t3, anchor);
    			insert_dev(target, div, anchor);
    			append_dev(div, h41);
    			append_dev(div, t5);
    			append_dev(div, p);
    			append_dev(p, t6);
    			append_dev(div, t7);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append_dev(div, t8);
    			append_dev(div, input);
    			append_dev(div, t9);
    			append_dev(div, button);
    			append_dev(button, t10);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*submit*/ ctx[13], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*endpoint*/ 128) show_if = Object.keys(/*endpoint*/ ctx[7].schema).length == 0;

    			if (show_if) {
    				if (if_block) ; else {
    					if_block = create_if_block_5(ctx);
    					if_block.c();
    					if_block.m(form, t2);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*Object, endpoint, values, hash*/ 131) {
    				each_value_1 = Object.entries(/*endpoint*/ ctx[7].schema);
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						each_blocks_1[i].m(form, null);
    					}
    				}

    				for (; i < each_blocks_1.length; i += 1) {
    					each_blocks_1[i].d(1);
    				}

    				each_blocks_1.length = each_value_1.length;
    			}

    			if (dirty & /*endpoint*/ 128 && t6_value !== (t6_value = /*endpoint*/ ctx[7].description + "")) set_data_dev(t6, t6_value);

    			if (dirty & /*components*/ 4) {
    				each_value = /*components*/ ctx[2];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div, t8);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*path*/ 256 && input.value !== /*path*/ ctx[8]) {
    				prop_dev(input, "value", /*path*/ ctx[8]);
    			}

    			if (dirty & /*waiting*/ 32) {
    				prop_dev(button, "disabled", /*waiting*/ ctx[5]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			if (if_block) if_block.d();
    			destroy_each(each_blocks_1, detaching);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(128:3) {#if endpoint}",
    		ctx
    	});

    	return block;
    }

    // (131:5) {#if Object.keys(endpoint.schema).length == 0 }
    function create_if_block_5(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "N/A";
    			attr_dev(div, "class", "fade");
    			add_location(div, file, 131, 6, 3333);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(131:5) {#if Object.keys(endpoint.schema).length == 0 }",
    		ctx
    	});

    	return block;
    }

    // (156:6) {:else}
    function create_else_block_1(ctx) {
    	let input;
    	let input_name_value;
    	let input_required_value;
    	let input_placeholder_value;
    	let mounted;
    	let dispose;

    	function input_input_handler() {
    		/*input_input_handler*/ ctx[20].call(input, /*key*/ ctx[27]);
    	}

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "name", input_name_value = /*key*/ ctx[27]);
    			attr_dev(input, "class", "flex grow p0-6");
    			input.required = input_required_value = /*value*/ ctx[28].required;
    			attr_dev(input, "placeholder", input_placeholder_value = /*key*/ ctx[27]);
    			add_location(input, file, 156, 7, 4078);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*values*/ ctx[0][/*hash*/ ctx[1]][/*key*/ ctx[27]]);

    			if (!mounted) {
    				dispose = listen_dev(input, "input", input_input_handler);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*endpoint*/ 128 && input_name_value !== (input_name_value = /*key*/ ctx[27])) {
    				attr_dev(input, "name", input_name_value);
    			}

    			if (dirty & /*endpoint*/ 128 && input_required_value !== (input_required_value = /*value*/ ctx[28].required)) {
    				prop_dev(input, "required", input_required_value);
    			}

    			if (dirty & /*endpoint*/ 128 && input_placeholder_value !== (input_placeholder_value = /*key*/ ctx[27])) {
    				attr_dev(input, "placeholder", input_placeholder_value);
    			}

    			if (dirty & /*values, hash, Object, endpoint*/ 131 && input.value !== /*values*/ ctx[0][/*hash*/ ctx[1]][/*key*/ ctx[27]]) {
    				set_input_value(input, /*values*/ ctx[0][/*hash*/ ctx[1]][/*key*/ ctx[27]]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(156:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (148:65) 
    function create_if_block_4(ctx) {
    	let textarea;
    	let textarea_name_value;
    	let textarea_required_value;
    	let textarea_placeholder_value;
    	let mounted;
    	let dispose;

    	function textarea_input_handler() {
    		/*textarea_input_handler*/ ctx[19].call(textarea, /*key*/ ctx[27]);
    	}

    	const block = {
    		c: function create() {
    			textarea = element("textarea");
    			attr_dev(textarea, "name", textarea_name_value = /*key*/ ctx[27]);
    			attr_dev(textarea, "class", "monospace flex grow p0-6");
    			attr_dev(textarea, "rows", "6");
    			textarea.required = textarea_required_value = /*value*/ ctx[28].required;
    			attr_dev(textarea, "placeholder", textarea_placeholder_value = /*key*/ ctx[27]);
    			add_location(textarea, file, 148, 7, 3862);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, textarea, anchor);
    			set_input_value(textarea, /*values*/ ctx[0][/*hash*/ ctx[1]][/*key*/ ctx[27]]);

    			if (!mounted) {
    				dispose = listen_dev(textarea, "input", textarea_input_handler);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*endpoint*/ 128 && textarea_name_value !== (textarea_name_value = /*key*/ ctx[27])) {
    				attr_dev(textarea, "name", textarea_name_value);
    			}

    			if (dirty & /*endpoint*/ 128 && textarea_required_value !== (textarea_required_value = /*value*/ ctx[28].required)) {
    				prop_dev(textarea, "required", textarea_required_value);
    			}

    			if (dirty & /*endpoint*/ 128 && textarea_placeholder_value !== (textarea_placeholder_value = /*key*/ ctx[27])) {
    				attr_dev(textarea, "placeholder", textarea_placeholder_value);
    			}

    			if (dirty & /*values, hash, Object, endpoint*/ 131) {
    				set_input_value(textarea, /*values*/ ctx[0][/*hash*/ ctx[1]][/*key*/ ctx[27]]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(textarea);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(148:65) ",
    		ctx
    	});

    	return block;
    }

    // (141:6) {#if value.type == 'boolean'}
    function create_if_block_3(ctx) {
    	let input;
    	let input_name_value;
    	let input_placeholder_value;
    	let input_required_value;
    	let mounted;
    	let dispose;

    	function input_change_handler() {
    		/*input_change_handler*/ ctx[18].call(input, /*key*/ ctx[27]);
    	}

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "name", input_name_value = /*key*/ ctx[27]);
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "placeholder", input_placeholder_value = /*key*/ ctx[27]);
    			input.required = input_required_value = /*value*/ ctx[28].required;
    			add_location(input, file, 141, 7, 3633);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*values*/ ctx[0][/*hash*/ ctx[1]][/*key*/ ctx[27]]);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", input_change_handler);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*endpoint*/ 128 && input_name_value !== (input_name_value = /*key*/ ctx[27])) {
    				attr_dev(input, "name", input_name_value);
    			}

    			if (dirty & /*endpoint*/ 128 && input_placeholder_value !== (input_placeholder_value = /*key*/ ctx[27])) {
    				attr_dev(input, "placeholder", input_placeholder_value);
    			}

    			if (dirty & /*endpoint*/ 128 && input_required_value !== (input_required_value = /*value*/ ctx[28].required)) {
    				prop_dev(input, "required", input_required_value);
    			}

    			if (dirty & /*values, hash, Object, endpoint*/ 131) {
    				set_input_value(input, /*values*/ ctx[0][/*hash*/ ctx[1]][/*key*/ ctx[27]]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(141:6) {#if value.type == 'boolean'}",
    		ctx
    	});

    	return block;
    }

    // (136:5) {#each Object.entries(endpoint.schema) as [key, value]}
    function create_each_block_1(ctx) {
    	let div;
    	let t0_value = /*key*/ ctx[27] + "";
    	let t0;
    	let t1;
    	let t2_value = (/*value*/ ctx[28].required ? "*" : "") + "";
    	let t2;
    	let t3;
    	let span;
    	let t4_value = /*value*/ ctx[28].type + "";
    	let t4;
    	let t5;
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*value*/ ctx[28].type == "boolean") return create_if_block_3;
    		if (/*value*/ ctx[28].type == "object" || /*value*/ ctx[28].type == "array") return create_if_block_4;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			t2 = text(t2_value);
    			t3 = space();
    			span = element("span");
    			t4 = text(t4_value);
    			t5 = space();
    			if_block.c();
    			if_block_anchor = empty();
    			attr_dev(span, "class", "fade normal monospace");
    			add_location(span, file, 138, 7, 3521);
    			attr_dev(div, "class", "bold");
    			add_location(div, file, 136, 6, 3454);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t0);
    			append_dev(div, t1);
    			append_dev(div, t2);
    			append_dev(div, t3);
    			append_dev(div, span);
    			append_dev(span, t4);
    			insert_dev(target, t5, anchor);
    			if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*endpoint*/ 128 && t0_value !== (t0_value = /*key*/ ctx[27] + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*endpoint*/ 128 && t2_value !== (t2_value = (/*value*/ ctx[28].required ? "*" : "") + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*endpoint*/ 128 && t4_value !== (t4_value = /*value*/ ctx[28].type + "")) set_data_dev(t4, t4_value);

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t5);
    			if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(136:5) {#each Object.entries(endpoint.schema) as [key, value]}",
    		ctx
    	});

    	return block;
    }

    // (173:6) {#if piece.type > 0}
    function create_if_block_2(ctx) {
    	let div;
    	let t0_value = /*piece*/ ctx[24].val + "";
    	let t0;
    	let t1;
    	let input;
    	let input_name_value;
    	let input_placeholder_value;
    	let mounted;
    	let dispose;

    	function input_input_handler_1() {
    		/*input_input_handler_1*/ ctx[21].call(input, /*each_value*/ ctx[25], /*piece_index*/ ctx[26]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			input = element("input");
    			attr_dev(div, "class", "bold");
    			add_location(div, file, 173, 7, 4468);
    			attr_dev(input, "name", input_name_value = /*piece*/ ctx[24].val);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", input_placeholder_value = /*piece*/ ctx[24].val);
    			add_location(input, file, 176, 7, 4528);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*piece*/ ctx[24].value);

    			if (!mounted) {
    				dispose = listen_dev(input, "input", input_input_handler_1);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty & /*components*/ 4 && t0_value !== (t0_value = /*piece*/ ctx[24].val + "")) set_data_dev(t0, t0_value);

    			if (dirty & /*components*/ 4 && input_name_value !== (input_name_value = /*piece*/ ctx[24].val)) {
    				attr_dev(input, "name", input_name_value);
    			}

    			if (dirty & /*components*/ 4 && input_placeholder_value !== (input_placeholder_value = /*piece*/ ctx[24].val)) {
    				attr_dev(input, "placeholder", input_placeholder_value);
    			}

    			if (dirty & /*components*/ 4 && input.value !== /*piece*/ ctx[24].value) {
    				set_input_value(input, /*piece*/ ctx[24].value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(input);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(173:6) {#if piece.type > 0}",
    		ctx
    	});

    	return block;
    }

    // (172:5) {#each components as piece}
    function create_each_block(ctx) {
    	let if_block_anchor;
    	let if_block = /*piece*/ ctx[24].type > 0 && create_if_block_2(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (/*piece*/ ctx[24].type > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_2(ctx);
    					if_block.c();
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(172:5) {#each components as piece}",
    		ctx
    	});

    	return block;
    }

    // (210:5) {:else}
    function create_else_block(ctx) {
    	let span;

    	const block = {
    		c: function create() {
    			span = element("span");
    			span.textContent = "N/A";
    			attr_dev(span, "class", "fade");
    			add_location(span, file, 210, 6, 5287);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(210:5) {:else}",
    		ctx
    	});

    	return block;
    }

    // (203:5) {#if timer && status }
    function create_if_block(ctx) {
    	let span;
    	let t0;
    	let t1;
    	let t2_value = /*timer*/ ctx[3].toFixed(2) + "";
    	let t2;
    	let t3;
    	let a;
    	let t4;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t0 = text(/*status*/ ctx[4]);
    			t1 = text("\n\t\t\t\t\t\tin ");
    			t2 = text(t2_value);
    			t3 = text("s \n\t\t\t\t\t\tfrom ");
    			a = element("a");
    			t4 = text(/*hash*/ ctx[1]);
    			attr_dev(span, "class", "bold");
    			add_location(span, file, 203, 6, 5086);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "href", /*hash*/ ctx[1]);
    			attr_dev(a, "class", "bb1-solid inline-block");
    			add_location(a, file, 205, 11, 5166);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, t2, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, a, anchor);
    			append_dev(a, t4);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*status*/ 16) set_data_dev(t0, /*status*/ ctx[4]);
    			if (dirty & /*timer*/ 8 && t2_value !== (t2_value = /*timer*/ ctx[3].toFixed(2) + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*hash*/ 2) set_data_dev(t4, /*hash*/ ctx[1]);

    			if (dirty & /*hash*/ 2) {
    				attr_dev(a, "href", /*hash*/ ctx[1]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(203:5) {#if timer && status }",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let div6;
    	let div1;
    	let div0;
    	let h40;
    	let t1;
    	let table;
    	let t2;
    	let div2;
    	let t3;
    	let div5;
    	let div3;
    	let h41;
    	let t5;
    	let p;
    	let t6;
    	let div4;
    	let h42;
    	let t8;
    	let pre;

    	let raw_value = (/*waiting*/ ctx[5]
    	? `<span class="fade">waiting...</span>`
    	: /*str*/ ctx[9]) + "";
    	let t9;
    	let div7;
    	let input0;
    	let t10;
    	let input1;
    	let t11;
    	let button;
    	let current;
    	let mounted;
    	let dispose;

    	table = new Table({
    			props: {
    				init: /*init*/ ctx[6],
    				callbacks: /*callbacks*/ ctx[11],
    				dimensions: /*dimensions*/ ctx[10]
    			},
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (/*endpoint*/ ctx[7]) return create_if_block_1;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_2(ctx, dirty) {
    		if (/*timer*/ ctx[3] && /*status*/ ctx[4]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type_1 = select_block_type_2(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div6 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			h40 = element("h4");
    			h40.textContent = "Endpoints";
    			t1 = space();
    			create_component(table.$$.fragment);
    			t2 = space();
    			div2 = element("div");
    			if_block0.c();
    			t3 = space();
    			div5 = element("div");
    			div3 = element("div");
    			h41 = element("h4");
    			h41.textContent = "Response";
    			t5 = space();
    			p = element("p");
    			if_block1.c();
    			t6 = space();
    			div4 = element("div");
    			h42 = element("h4");
    			h42.textContent = "Data";
    			t8 = space();
    			pre = element("pre");
    			t9 = space();
    			div7 = element("div");
    			input0 = element("input");
    			t10 = space();
    			input1 = element("input");
    			t11 = space();
    			button = element("button");
    			button.textContent = "login";
    			attr_dev(h40, "class", "bold");
    			add_location(h40, file, 121, 4, 3017);
    			attr_dev(div0, "class", "p1");
    			add_location(div0, file, 120, 3, 2996);
    			attr_dev(div1, "class", "flex column no-basis br1-solid grow overflow-auto");
    			add_location(div1, file, 119, 2, 2929);
    			attr_dev(div2, "class", "flex column no-basis br1-solid grow overflow-auto");
    			add_location(div2, file, 125, 2, 3115);
    			attr_dev(h41, "class", "bold");
    			add_location(h41, file, 200, 4, 5000);
    			attr_dev(p, "class", "mtb1");
    			add_location(p, file, 201, 4, 5035);
    			attr_dev(div3, "class", "p1");
    			add_location(div3, file, 199, 3, 4979);
    			attr_dev(h42, "class", "bold");
    			add_location(h42, file, 215, 4, 5395);
    			attr_dev(pre, "class", "pre mtb1 monospace");

    			attr_dev(pre, "style", `
					white-space:normal;
					word-break:break-word;
				`);

    			add_location(pre, file, 216, 4, 5426);
    			attr_dev(div4, "class", "p1 bt1-solid overflow-auto");
    			add_location(div4, file, 214, 3, 5350);
    			attr_dev(div5, "class", "flex flex-column grow no-basis");
    			add_location(div5, file, 195, 2, 4928);
    			attr_dev(div6, "class", "flex grow");
    			add_location(div6, file, 118, 1, 2903);
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "username");
    			add_location(input0, file, 227, 2, 5671);
    			attr_dev(input1, "type", "password");
    			attr_dev(input1, "placeholder", "password");
    			add_location(input1, file, 228, 2, 5718);
    			add_location(button, file, 229, 2, 5769);
    			attr_dev(div7, "class", "flex p1 bt1-solid");
    			add_location(div7, file, 226, 1, 5637);
    			attr_dev(main, "class", "flex column-stretch-stretch h100vh");
    			add_location(main, file, 117, 0, 2852);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div6);
    			append_dev(div6, div1);
    			append_dev(div1, div0);
    			append_dev(div0, h40);
    			append_dev(div1, t1);
    			mount_component(table, div1, null);
    			append_dev(div6, t2);
    			append_dev(div6, div2);
    			if_block0.m(div2, null);
    			append_dev(div6, t3);
    			append_dev(div6, div5);
    			append_dev(div5, div3);
    			append_dev(div3, h41);
    			append_dev(div3, t5);
    			append_dev(div3, p);
    			if_block1.m(p, null);
    			append_dev(div5, t6);
    			append_dev(div5, div4);
    			append_dev(div4, h42);
    			append_dev(div4, t8);
    			append_dev(div4, pre);
    			pre.innerHTML = raw_value;
    			append_dev(main, t9);
    			append_dev(main, div7);
    			append_dev(div7, input0);
    			append_dev(div7, t10);
    			append_dev(div7, input1);
    			append_dev(div7, t11);
    			append_dev(div7, button);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(window_1, "hashchange", /*onHashChange*/ ctx[12], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			const table_changes = {};
    			if (dirty & /*init*/ 64) table_changes.init = /*init*/ ctx[6];
    			table.$set(table_changes);

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div2, null);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_2(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(p, null);
    				}
    			}

    			if ((!current || dirty & /*waiting, str*/ 544) && raw_value !== (raw_value = (/*waiting*/ ctx[5]
    			? `<span class="fade">waiting...</span>`
    			: /*str*/ ctx[9]) + "")) pre.innerHTML = raw_value;		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(table.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(table.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(table);
    			if_block0.d();
    			if_block1.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let init;
    	let endpoint;
    	let args;
    	let regexed;
    	let path;
    	let str;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Overview", slots, []);
    	let endpoints = [];

    	onMount(async () => {
    		const res = await fetch(`endpoints`);
    		const types = ["get", "post", "put", "delete"];
    		$$invalidate(14, endpoints = (await res.json()).filter(e => types.indexOf(e.type) != -1));
    	});

    	let dimensions = { padding: 0.1, widths: [100, 60, 200] };

    	let callbacks = {
    		render: {
    			cell: o => {
    				let fill = `p1 unclickable flex row-flex-start-center`;
    				if (o.item.url == hash) fill += " filled";

    				if (o.key == "url") return `
					<a class="${fill}" href="${o.value}" target="_blank">
						<span class="bb1-solid">${o.value}</span>
					</a>
				`;

    				return `
					<a class="${fill}" href="#${o.item.url}">${o.value}</a>
				`;
    			},
    			key: o => {
    				return `
					<span class="p1 block bold">${o.value}</span>
				`;
    			}
    		}
    	};

    	let timestamp, timer, status;
    	let waiting = false;
    	let values = {};
    	let hash, data = "";
    	let components = [];
    	onHashChange();

    	function onHashChange() {
    		$$invalidate(1, hash = window.location.hash.substring(1));
    		if (!values[hash]) $$invalidate(0, values[hash] = {}, values);
    		for (let i = 0; i < endpoints.length; i++) $$invalidate(14, endpoints[i].selected = endpoints[i]?.item?.url == hash, endpoints);
    		$$invalidate(4, status = null);
    		$$invalidate(5, waiting = false);
    		$$invalidate(15, data = "");
    		$$invalidate(2, components = parse(hash));
    	}

    	function path_(url, args) {
    		if (args == undefined) return url;
    		const keys = Object.keys(args);

    		for (let i = 0; i < keys.length; i++) {
    			const key = keys[i];
    			if (i == 0) url += "?";

    			if (args[key] != undefined && args[key] != "") {
    				url += `${key}=${encodeURIComponent(args[key])}`;
    				if (i != keys.length - 1) url += "&";
    			}
    		}

    		return url;
    	}

    	async function submit() {
    		let copy = JSON.parse(JSON.stringify(args));

    		Object.keys(copy).forEach(k => {
    			const sch = endpoint.schema[k];

    			if (sch.type == "object" || sch.type == "array") {
    				try {
    					copy[k] = eval("(" + copy[k] + ")");
    					console.log(`[Overview]  parsed object / array ${k}:`, copy[k]);
    				} catch(err) {
    					console.warn(`[Overview]  couldn't parse ${k}:`, err.message, copy[k]);
    					copy[k] = null;
    				}
    			}
    		});

    		timestamp = new Date();
    		$$invalidate(15, data = "");
    		$$invalidate(5, waiting = true);
    		const res = await fetcher[endpoint.type](regexed, copy, false);
    		$$invalidate(4, status = res.status || res.code);
    		if (res.ok) $$invalidate(15, data = res.data);
    		if (res.error) $$invalidate(15, data = res.message);
    		$$invalidate(5, waiting = false);
    		$$invalidate(3, timer = (new Date() - timestamp) / 1000);
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Overview> was created with unknown prop '${key}'`);
    	});

    	function input_change_handler(key) {
    		values[hash][key] = this.value;
    		$$invalidate(0, values);
    		$$invalidate(1, hash);
    		(($$invalidate(7, endpoint), $$invalidate(14, endpoints)), $$invalidate(1, hash));
    	}

    	function textarea_input_handler(key) {
    		values[hash][key] = this.value;
    		$$invalidate(0, values);
    		$$invalidate(1, hash);
    		(($$invalidate(7, endpoint), $$invalidate(14, endpoints)), $$invalidate(1, hash));
    	}

    	function input_input_handler(key) {
    		values[hash][key] = this.value;
    		$$invalidate(0, values);
    		$$invalidate(1, hash);
    		(($$invalidate(7, endpoint), $$invalidate(14, endpoints)), $$invalidate(1, hash));
    	}

    	function input_input_handler_1(each_value, piece_index) {
    		each_value[piece_index].value = this.value;
    		$$invalidate(2, components);
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		fetcher,
    		Table,
    		parse,
    		endpoints,
    		dimensions,
    		callbacks,
    		timestamp,
    		timer,
    		status,
    		waiting,
    		values,
    		hash,
    		data,
    		components,
    		onHashChange,
    		path_,
    		submit,
    		init,
    		endpoint,
    		args,
    		regexed,
    		path,
    		str
    	});

    	$$self.$inject_state = $$props => {
    		if ("endpoints" in $$props) $$invalidate(14, endpoints = $$props.endpoints);
    		if ("dimensions" in $$props) $$invalidate(10, dimensions = $$props.dimensions);
    		if ("callbacks" in $$props) $$invalidate(11, callbacks = $$props.callbacks);
    		if ("timestamp" in $$props) timestamp = $$props.timestamp;
    		if ("timer" in $$props) $$invalidate(3, timer = $$props.timer);
    		if ("status" in $$props) $$invalidate(4, status = $$props.status);
    		if ("waiting" in $$props) $$invalidate(5, waiting = $$props.waiting);
    		if ("values" in $$props) $$invalidate(0, values = $$props.values);
    		if ("hash" in $$props) $$invalidate(1, hash = $$props.hash);
    		if ("data" in $$props) $$invalidate(15, data = $$props.data);
    		if ("components" in $$props) $$invalidate(2, components = $$props.components);
    		if ("init" in $$props) $$invalidate(6, init = $$props.init);
    		if ("endpoint" in $$props) $$invalidate(7, endpoint = $$props.endpoint);
    		if ("args" in $$props) $$invalidate(16, args = $$props.args);
    		if ("regexed" in $$props) $$invalidate(17, regexed = $$props.regexed);
    		if ("path" in $$props) $$invalidate(8, path = $$props.path);
    		if ("str" in $$props) $$invalidate(9, str = $$props.str);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*endpoints*/ 16384) {
    			$$invalidate(6, init = {
    				data: endpoints,
    				keys: ["category", "type", "url", "description"],
    				index: "url"
    			});
    		}

    		if ($$self.$$.dirty & /*endpoints, hash*/ 16386) {
    			$$invalidate(7, endpoint = endpoints.find(e => e.url == hash && hash != ""));
    		}

    		if ($$self.$$.dirty & /*values, hash*/ 3) {
    			$$invalidate(16, args = values[hash]);
    		}

    		if ($$self.$$.dirty & /*components*/ 4) {
    			$$invalidate(17, regexed = "/" + components.map(c => c.value || c.val).join("/"));
    		}

    		if ($$self.$$.dirty & /*regexed, args*/ 196608) {
    			$$invalidate(8, path = path_(regexed, args));
    		}

    		if ($$self.$$.dirty & /*data*/ 32768) {
    			$$invalidate(9, str = JSON.stringify(data, null, 2));
    		}
    	};

    	return [
    		values,
    		hash,
    		components,
    		timer,
    		status,
    		waiting,
    		init,
    		endpoint,
    		path,
    		str,
    		dimensions,
    		callbacks,
    		onHashChange,
    		submit,
    		endpoints,
    		data,
    		args,
    		regexed,
    		input_change_handler,
    		textarea_input_handler,
    		input_input_handler,
    		input_input_handler_1
    	];
    }

    class Overview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Overview",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    const overview = new Overview({
    	target: document.body,
    	props: {  }
    });

    return overview;

}());
