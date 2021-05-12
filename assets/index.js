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
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
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
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
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
    	    try { data = JSON.parse( data ); } catch(err) {}

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


    var fetcheriser = out;

    function log( msg ) {
    	console.log( `[svelte-tabular-table] ${msg}`);
    }

    const defaults = {
    	hover: o => log(`${o.id} "${o.key}" -> hovered`),
    	click: o => log(`${o.id} "${o.key}" -> clicked`),
    	dblclick: o => log(`${o.id} "${o.key}" -> double clicked`),
    	render: o => o.value,
    	checked: o => log(`${o.id} -> ${o.event.target.checked ? 'checked' : 'unchecked'}`),
    	sort: (conf, data, meta) => {
    		let copy = data;
    		data = null;
    		copy.sort( (a,b) => {
    			let aa = a[conf.key] || '';
    			let bb = b[conf.key] || '';
    			if ( typeof(aa) == 'string' ) aa = aa.toLowerCase();
    			if ( typeof(bb) == 'string' ) bb = bb.toLowerCase();
    			return +(aa > bb) || +(aa === bb) - 1
    		});
    		if ( conf.direction ) copy = copy.reverse();
    		return copy
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

    /* node_modules/.pnpm/svelte-tabular-table@1.0.6/node_modules/svelte-tabular-table/src/Td.svelte generated by Svelte v3.38.2 */
    const file$3 = "node_modules/.pnpm/svelte-tabular-table@1.0.6/node_modules/svelte-tabular-table/src/Td.svelte";

    // (126:0) {:else}
    function create_else_block_5(ctx) {
    	let td;
    	let current_block_type_index;
    	let if_block;
    	let td_width_value;
    	let td_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const if_block_creators = [create_if_block_6, create_else_block_8];
    	const if_blocks = [];

    	function select_block_type_6(ctx, dirty) {
    		if (/*init*/ ctx[0].nodiv) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_6(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			td = element("td");
    			if_block.c();
    			attr_dev(td, "style", /*tdStyle*/ ctx[11]);
    			attr_dev(td, "colspan", /*colspan*/ ctx[3]);
    			attr_dev(td, "width", td_width_value = /*width*/ ctx[5] || undefined);
    			attr_dev(td, "class", td_class_value = /*class_*/ ctx[4] + " stt-" + slugify(/*key*/ ctx[1]));
    			attr_dev(td, "data-key", /*key*/ ctx[1]);
    			toggle_class(td, "stt-sticky", /*sticky*/ ctx[6]);
    			toggle_class(td, "stt-sorted", /*same*/ ctx[13]);
    			toggle_class(td, "stt-ascending", /*same*/ ctx[13] && /*direction*/ ctx[12]);
    			toggle_class(td, "stt-descending", /*same*/ ctx[13] && !/*direction*/ ctx[12]);
    			add_location(td, file$3, 127, 1, 3185);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, td, anchor);
    			if_blocks[current_block_type_index].m(td, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(td, "click", /*click_handler_1*/ ctx[33], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_6(ctx);

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

    			if (!current || dirty[0] & /*tdStyle*/ 2048) {
    				attr_dev(td, "style", /*tdStyle*/ ctx[11]);
    			}

    			if (!current || dirty[0] & /*colspan*/ 8) {
    				attr_dev(td, "colspan", /*colspan*/ ctx[3]);
    			}

    			if (!current || dirty[0] & /*width*/ 32 && td_width_value !== (td_width_value = /*width*/ ctx[5] || undefined)) {
    				attr_dev(td, "width", td_width_value);
    			}

    			if (!current || dirty[0] & /*class_, key*/ 18 && td_class_value !== (td_class_value = /*class_*/ ctx[4] + " stt-" + slugify(/*key*/ ctx[1]))) {
    				attr_dev(td, "class", td_class_value);
    			}

    			if (!current || dirty[0] & /*key*/ 2) {
    				attr_dev(td, "data-key", /*key*/ ctx[1]);
    			}

    			if (dirty[0] & /*class_, key, sticky*/ 82) {
    				toggle_class(td, "stt-sticky", /*sticky*/ ctx[6]);
    			}

    			if (dirty[0] & /*class_, key, same*/ 8210) {
    				toggle_class(td, "stt-sorted", /*same*/ ctx[13]);
    			}

    			if (dirty[0] & /*class_, key, same, direction*/ 12306) {
    				toggle_class(td, "stt-ascending", /*same*/ ctx[13] && /*direction*/ ctx[12]);
    			}

    			if (dirty[0] & /*class_, key, same, direction*/ 12306) {
    				toggle_class(td, "stt-descending", /*same*/ ctx[13] && !/*direction*/ ctx[12]);
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
    		id: create_else_block_5.name,
    		type: "else",
    		source: "(126:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (93:0) {#if type == 'key'}
    function create_if_block$3(ctx) {
    	let th;
    	let current_block_type_index;
    	let if_block;
    	let th_width_value;
    	let th_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const if_block_creators = [create_if_block_1$2, create_else_block_2$1];
    	const if_blocks = [];

    	function select_block_type_1(ctx, dirty) {
    		if (/*init*/ ctx[0].nodiv) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_1(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			th = element("th");
    			if_block.c();
    			attr_dev(th, "style", /*tdStyle*/ ctx[11]);
    			attr_dev(th, "colspan", /*colspan*/ ctx[3]);
    			attr_dev(th, "width", th_width_value = /*width*/ ctx[5] || undefined);
    			attr_dev(th, "class", th_class_value = /*class_*/ ctx[4] + " stt-" + slugify(/*key*/ ctx[1]));
    			attr_dev(th, "data-key", /*key*/ ctx[1]);
    			toggle_class(th, "stt-sticky", /*sticky*/ ctx[6]);
    			toggle_class(th, "stt-sorted", /*same*/ ctx[13]);
    			toggle_class(th, "stt-ascending", /*same*/ ctx[13] && /*direction*/ ctx[12]);
    			toggle_class(th, "stt-descending", /*same*/ ctx[13] && !/*direction*/ ctx[12]);
    			add_location(th, file$3, 94, 1, 2416);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, th, anchor);
    			if_blocks[current_block_type_index].m(th, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(th, "click", /*click_handler*/ ctx[32], false, false, false);
    				mounted = true;
    			}
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
    				if_block.m(th, null);
    			}

    			if (!current || dirty[0] & /*tdStyle*/ 2048) {
    				attr_dev(th, "style", /*tdStyle*/ ctx[11]);
    			}

    			if (!current || dirty[0] & /*colspan*/ 8) {
    				attr_dev(th, "colspan", /*colspan*/ ctx[3]);
    			}

    			if (!current || dirty[0] & /*width*/ 32 && th_width_value !== (th_width_value = /*width*/ ctx[5] || undefined)) {
    				attr_dev(th, "width", th_width_value);
    			}

    			if (!current || dirty[0] & /*class_, key*/ 18 && th_class_value !== (th_class_value = /*class_*/ ctx[4] + " stt-" + slugify(/*key*/ ctx[1]))) {
    				attr_dev(th, "class", th_class_value);
    			}

    			if (!current || dirty[0] & /*key*/ 2) {
    				attr_dev(th, "data-key", /*key*/ ctx[1]);
    			}

    			if (dirty[0] & /*class_, key, sticky*/ 82) {
    				toggle_class(th, "stt-sticky", /*sticky*/ ctx[6]);
    			}

    			if (dirty[0] & /*class_, key, same*/ 8210) {
    				toggle_class(th, "stt-sorted", /*same*/ ctx[13]);
    			}

    			if (dirty[0] & /*class_, key, same, direction*/ 12306) {
    				toggle_class(th, "stt-ascending", /*same*/ ctx[13] && /*direction*/ ctx[12]);
    			}

    			if (dirty[0] & /*class_, key, same, direction*/ 12306) {
    				toggle_class(th, "stt-descending", /*same*/ ctx[13] && !/*direction*/ ctx[12]);
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
    			if (detaching) detach_dev(th);
    			if_blocks[current_block_type_index].d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(93:0) {#if type == 'key'}",
    		ctx
    	});

    	return block;
    }

    // (145:2) {:else}
    function create_else_block_8(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block_9, create_else_block_10];
    	const if_blocks = [];

    	function select_block_type_9(ctx, dirty) {
    		if (!/*$$slots*/ ctx[16].default) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_9(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "style", /*style*/ ctx[10]);
    			toggle_class(div, "chevron", /*same*/ ctx[13] && /*type*/ ctx[2] == "key");
    			add_location(div, file$3, 145, 3, 3686);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type_9(ctx);

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

    			if (!current || dirty[0] & /*style*/ 1024) {
    				attr_dev(div, "style", /*style*/ ctx[10]);
    			}

    			if (dirty[0] & /*same, type*/ 8196) {
    				toggle_class(div, "chevron", /*same*/ ctx[13] && /*type*/ ctx[2] == "key");
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
    		id: create_else_block_8.name,
    		type: "else",
    		source: "(145:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (138:2) {#if init.nodiv}
    function create_if_block_6(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_7, create_else_block_7];
    	const if_blocks = [];

    	function select_block_type_7(ctx, dirty) {
    		if (!/*$$slots*/ ctx[16].default) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_7(ctx);
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
    			current_block_type_index = select_block_type_7(ctx);

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
    		id: create_if_block_6.name,
    		type: "if",
    		source: "(138:2) {#if init.nodiv}",
    		ctx
    	});

    	return block;
    }

    // (152:4) {:else}
    function create_else_block_10(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[31].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[30], null);

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
    				if (default_slot.p && (!current || dirty[0] & /*$$scope*/ 1073741824)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[30], dirty, null, null);
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
    		id: create_else_block_10.name,
    		type: "else",
    		source: "(152:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (149:4) {#if !$$slots.default }
    function create_if_block_9(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_10, create_else_block_9];
    	const if_blocks = [];

    	function select_block_type_10(ctx, dirty) {
    		if (/*component*/ ctx[9]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_10(ctx);
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
    			current_block_type_index = select_block_type_10(ctx);

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
    		id: create_if_block_9.name,
    		type: "if",
    		source: "(149:4) {#if !$$slots.default }",
    		ctx
    	});

    	return block;
    }

    // (151:5) {:else}
    function create_else_block_9(ctx) {
    	let html_tag;
    	let html_anchor;

    	const block = {
    		c: function create() {
    			html_anchor = empty();
    			html_tag = new HtmlTag(html_anchor);
    		},
    		m: function mount(target, anchor) {
    			html_tag.m(/*render*/ ctx[14], target, anchor);
    			insert_dev(target, html_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*render*/ 16384) html_tag.p(/*render*/ ctx[14]);
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
    		id: create_else_block_9.name,
    		type: "else",
    		source: "(151:5) {:else}",
    		ctx
    	});

    	return block;
    }

    // (150:5) {#if component }
    function create_if_block_10(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*obj*/ ctx[7]];
    	var switch_value = /*renderFunc*/ ctx[8];

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
    			const switch_instance_changes = (dirty[0] & /*obj*/ 128)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*obj*/ ctx[7])])
    			: {};

    			if (switch_value !== (switch_value = /*renderFunc*/ ctx[8])) {
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
    		id: create_if_block_10.name,
    		type: "if",
    		source: "(150:5) {#if component }",
    		ctx
    	});

    	return block;
    }

    // (142:3) {:else}
    function create_else_block_7(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[31].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[30], null);

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
    				if (default_slot.p && (!current || dirty[0] & /*$$scope*/ 1073741824)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[30], dirty, null, null);
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
    		id: create_else_block_7.name,
    		type: "else",
    		source: "(142:3) {:else}",
    		ctx
    	});

    	return block;
    }

    // (139:3) {#if !$$slots.default }
    function create_if_block_7(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_8, create_else_block_6];
    	const if_blocks = [];

    	function select_block_type_8(ctx, dirty) {
    		if (/*component*/ ctx[9]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_8(ctx);
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
    			current_block_type_index = select_block_type_8(ctx);

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
    		id: create_if_block_7.name,
    		type: "if",
    		source: "(139:3) {#if !$$slots.default }",
    		ctx
    	});

    	return block;
    }

    // (141:4) {:else}
    function create_else_block_6(ctx) {
    	let html_tag;
    	let html_anchor;

    	const block = {
    		c: function create() {
    			html_anchor = empty();
    			html_tag = new HtmlTag(html_anchor);
    		},
    		m: function mount(target, anchor) {
    			html_tag.m(/*render*/ ctx[14], target, anchor);
    			insert_dev(target, html_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*render*/ 16384) html_tag.p(/*render*/ ctx[14]);
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
    		id: create_else_block_6.name,
    		type: "else",
    		source: "(141:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (140:4) {#if component }
    function create_if_block_8(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*obj*/ ctx[7]];
    	var switch_value = /*renderFunc*/ ctx[8];

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
    			const switch_instance_changes = (dirty[0] & /*obj*/ 128)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*obj*/ ctx[7])])
    			: {};

    			if (switch_value !== (switch_value = /*renderFunc*/ ctx[8])) {
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
    		id: create_if_block_8.name,
    		type: "if",
    		source: "(140:4) {#if component }",
    		ctx
    	});

    	return block;
    }

    // (112:2) {:else}
    function create_else_block_2$1(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block_4$1, create_else_block_4];
    	const if_blocks = [];

    	function select_block_type_4(ctx, dirty) {
    		if (!/*$$slots*/ ctx[16].default) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_4(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			attr_dev(div, "style", /*style*/ ctx[10]);
    			toggle_class(div, "chevron", /*same*/ ctx[13] && /*type*/ ctx[2] == "key");
    			add_location(div, file$3, 112, 3, 2917);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
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
    				if_block.m(div, null);
    			}

    			if (!current || dirty[0] & /*style*/ 1024) {
    				attr_dev(div, "style", /*style*/ ctx[10]);
    			}

    			if (dirty[0] & /*same, type*/ 8196) {
    				toggle_class(div, "chevron", /*same*/ ctx[13] && /*type*/ ctx[2] == "key");
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
    		source: "(112:2) {:else}",
    		ctx
    	});

    	return block;
    }

    // (105:2) {#if init.nodiv}
    function create_if_block_1$2(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_2$2, create_else_block_1$1];
    	const if_blocks = [];

    	function select_block_type_2(ctx, dirty) {
    		if (!/*$$slots*/ ctx[16].default) return 0;
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
    		source: "(105:2) {#if init.nodiv}",
    		ctx
    	});

    	return block;
    }

    // (119:4) {:else}
    function create_else_block_4(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[31].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[30], null);

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
    				if (default_slot.p && (!current || dirty[0] & /*$$scope*/ 1073741824)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[30], dirty, null, null);
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
    		source: "(119:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (116:4) {#if !$$slots.default }
    function create_if_block_4$1(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_5$1, create_else_block_3];
    	const if_blocks = [];

    	function select_block_type_5(ctx, dirty) {
    		if (/*component*/ ctx[9]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_5(ctx);
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
    			current_block_type_index = select_block_type_5(ctx);

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
    		id: create_if_block_4$1.name,
    		type: "if",
    		source: "(116:4) {#if !$$slots.default }",
    		ctx
    	});

    	return block;
    }

    // (118:5) {:else}
    function create_else_block_3(ctx) {
    	let html_tag;
    	let html_anchor;

    	const block = {
    		c: function create() {
    			html_anchor = empty();
    			html_tag = new HtmlTag(html_anchor);
    		},
    		m: function mount(target, anchor) {
    			html_tag.m(/*render*/ ctx[14], target, anchor);
    			insert_dev(target, html_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*render*/ 16384) html_tag.p(/*render*/ ctx[14]);
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
    		source: "(118:5) {:else}",
    		ctx
    	});

    	return block;
    }

    // (117:5) {#if component }
    function create_if_block_5$1(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*obj*/ ctx[7]];
    	var switch_value = /*renderFunc*/ ctx[8];

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
    			const switch_instance_changes = (dirty[0] & /*obj*/ 128)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*obj*/ ctx[7])])
    			: {};

    			if (switch_value !== (switch_value = /*renderFunc*/ ctx[8])) {
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
    		id: create_if_block_5$1.name,
    		type: "if",
    		source: "(117:5) {#if component }",
    		ctx
    	});

    	return block;
    }

    // (109:3) {:else}
    function create_else_block_1$1(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[31].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[30], null);

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
    				if (default_slot.p && (!current || dirty[0] & /*$$scope*/ 1073741824)) {
    					update_slot(default_slot, default_slot_template, ctx, /*$$scope*/ ctx[30], dirty, null, null);
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
    		source: "(109:3) {:else}",
    		ctx
    	});

    	return block;
    }

    // (106:3) {#if !$$slots.default }
    function create_if_block_2$2(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_3$2, create_else_block$2];
    	const if_blocks = [];

    	function select_block_type_3(ctx, dirty) {
    		if (/*component*/ ctx[9]) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type_3(ctx);
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
    		id: create_if_block_2$2.name,
    		type: "if",
    		source: "(106:3) {#if !$$slots.default }",
    		ctx
    	});

    	return block;
    }

    // (108:4) {:else}
    function create_else_block$2(ctx) {
    	let html_tag;
    	let html_anchor;

    	const block = {
    		c: function create() {
    			html_anchor = empty();
    			html_tag = new HtmlTag(html_anchor);
    		},
    		m: function mount(target, anchor) {
    			html_tag.m(/*render*/ ctx[14], target, anchor);
    			insert_dev(target, html_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*render*/ 16384) html_tag.p(/*render*/ ctx[14]);
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
    		source: "(108:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (107:4) {#if component }
    function create_if_block_3$2(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	const switch_instance_spread_levels = [/*obj*/ ctx[7]];
    	var switch_value = /*renderFunc*/ ctx[8];

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
    			const switch_instance_changes = (dirty[0] & /*obj*/ 128)
    			? get_spread_update(switch_instance_spread_levels, [get_spread_object(/*obj*/ ctx[7])])
    			: {};

    			if (switch_value !== (switch_value = /*renderFunc*/ ctx[8])) {
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
    		id: create_if_block_3$2.name,
    		type: "if",
    		source: "(107:4) {#if component }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block$3, create_else_block_5];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*type*/ ctx[2] == "key") return 0;
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
    	let sticky;
    	let obj;
    	let cbs;
    	let renderFunc;
    	let clickFunc;
    	let dblClickFunc;
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
    	let { rowIndex } = $$props;
    	let { cellIndex } = $$props;
    	let { type } = $$props;
    	let { colspan = 1 } = $$props;
    	let { class: class_ = "" } = $$props;
    	let clickCount = 0;

    	function onClick(obj, e) {
    		clickCount += 1;

    		setTimeout(
    			() => {
    				if (clickCount === 1) clickFunc({ ...obj, event: e }); else if (clickCount === 2) dblClickFunc({ ...obj, event: e });
    				clickCount = 0;
    			},
    			0
    		);

    		const exists = init.keys.indexOf(key) != -1;

    		if (type == "key" && exists && sorting) {
    			misc.reorder({ id, item, key, e });
    		}
    	}

    	const click_handler = e => onClick(obj, e);
    	const click_handler_1 = e => onClick(obj, e);

    	$$self.$$set = $$new_props => {
    		$$invalidate(38, $$props = assign(assign({}, $$props), exclude_internal_props($$new_props)));
    		if ("init" in $$new_props) $$invalidate(0, init = $$new_props.init);
    		if ("dimensions" in $$new_props) $$invalidate(17, dimensions = $$new_props.dimensions);
    		if ("debug" in $$new_props) $$invalidate(18, debug = $$new_props.debug);
    		if ("callbacks" in $$new_props) $$invalidate(19, callbacks = $$new_props.callbacks);
    		if ("features" in $$new_props) $$invalidate(20, features = $$new_props.features);
    		if ("misc" in $$new_props) $$invalidate(21, misc = $$new_props.misc);
    		if ("id" in $$new_props) $$invalidate(22, id = $$new_props.id);
    		if ("item" in $$new_props) $$invalidate(23, item = $$new_props.item);
    		if ("key" in $$new_props) $$invalidate(1, key = $$new_props.key);
    		if ("rowIndex" in $$new_props) $$invalidate(24, rowIndex = $$new_props.rowIndex);
    		if ("cellIndex" in $$new_props) $$invalidate(25, cellIndex = $$new_props.cellIndex);
    		if ("type" in $$new_props) $$invalidate(2, type = $$new_props.type);
    		if ("colspan" in $$new_props) $$invalidate(3, colspan = $$new_props.colspan);
    		if ("class" in $$new_props) $$invalidate(4, class_ = $$new_props.class);
    		if ("$$scope" in $$new_props) $$invalidate(30, $$scope = $$new_props.$$scope);
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
    		rowIndex,
    		cellIndex,
    		type,
    		colspan,
    		class_,
    		clickCount,
    		onClick,
    		width,
    		_refresh,
    		_style,
    		style,
    		tdStyle,
    		sticky,
    		sorting,
    		hasSlot,
    		obj,
    		cbs,
    		renderFunc,
    		clickFunc,
    		dblClickFunc,
    		direction,
    		same,
    		render,
    		component
    	});

    	$$self.$inject_state = $$new_props => {
    		$$invalidate(38, $$props = assign(assign({}, $$props), $$new_props));
    		if ("init" in $$props) $$invalidate(0, init = $$new_props.init);
    		if ("dimensions" in $$props) $$invalidate(17, dimensions = $$new_props.dimensions);
    		if ("debug" in $$props) $$invalidate(18, debug = $$new_props.debug);
    		if ("callbacks" in $$props) $$invalidate(19, callbacks = $$new_props.callbacks);
    		if ("features" in $$props) $$invalidate(20, features = $$new_props.features);
    		if ("misc" in $$props) $$invalidate(21, misc = $$new_props.misc);
    		if ("id" in $$props) $$invalidate(22, id = $$new_props.id);
    		if ("item" in $$props) $$invalidate(23, item = $$new_props.item);
    		if ("key" in $$props) $$invalidate(1, key = $$new_props.key);
    		if ("rowIndex" in $$props) $$invalidate(24, rowIndex = $$new_props.rowIndex);
    		if ("cellIndex" in $$props) $$invalidate(25, cellIndex = $$new_props.cellIndex);
    		if ("type" in $$props) $$invalidate(2, type = $$new_props.type);
    		if ("colspan" in $$props) $$invalidate(3, colspan = $$new_props.colspan);
    		if ("class_" in $$props) $$invalidate(4, class_ = $$new_props.class_);
    		if ("clickCount" in $$props) clickCount = $$new_props.clickCount;
    		if ("width" in $$props) $$invalidate(5, width = $$new_props.width);
    		if ("_refresh" in $$props) $$invalidate(26, _refresh = $$new_props._refresh);
    		if ("_style" in $$props) $$invalidate(27, _style = $$new_props._style);
    		if ("style" in $$props) $$invalidate(10, style = $$new_props.style);
    		if ("tdStyle" in $$props) $$invalidate(11, tdStyle = $$new_props.tdStyle);
    		if ("sticky" in $$props) $$invalidate(6, sticky = $$new_props.sticky);
    		if ("sorting" in $$props) $$invalidate(28, sorting = $$new_props.sorting);
    		if ("hasSlot" in $$props) hasSlot = $$new_props.hasSlot;
    		if ("obj" in $$props) $$invalidate(7, obj = $$new_props.obj);
    		if ("cbs" in $$props) $$invalidate(29, cbs = $$new_props.cbs);
    		if ("renderFunc" in $$props) $$invalidate(8, renderFunc = $$new_props.renderFunc);
    		if ("clickFunc" in $$props) clickFunc = $$new_props.clickFunc;
    		if ("dblClickFunc" in $$props) dblClickFunc = $$new_props.dblClickFunc;
    		if ("direction" in $$props) $$invalidate(12, direction = $$new_props.direction);
    		if ("same" in $$props) $$invalidate(13, same = $$new_props.same);
    		if ("render" in $$props) $$invalidate(14, render = $$new_props.render);
    		if ("component" in $$props) $$invalidate(9, component = $$new_props.component);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*cellIndex, dimensions*/ 33685504) {
    			$$invalidate(5, width = cellIndex == -1
    			? 100
    			: (dimensions.widths || [])[cellIndex]);
    		}

    		if ($$self.$$.dirty[0] & /*misc*/ 2097152) {
    			$$invalidate(26, _refresh = misc.refresh ? " " : "");
    		}

    		if ($$self.$$.dirty[0] & /*dimensions, features*/ 1179648) {
    			$$invalidate(27, _style = e => {
    				let s = `
			overflow-wrap:break-word;
			box-sizing:content-box;
			display: flex;
			align-items: center;`;

    				const rowDefined = dimensions.row != undefined;
    				const paddDefined = dimensions.padding != undefined;
    				const whitespace = "white-space: nowrap;overflow:hidden;text-overflow: ellipsis;";
    				const em = rowDefined ? dimensions.row + "px;" : "auto;";
    				if (paddDefined) s += "padding:" + dimensions.padding + "px;";

    				s += features.autohide || rowDefined
    				? whitespace + "height:" + em + "line-height:" + em
    				: "";

    				return s;
    			});
    		}

    		if ($$self.$$.dirty[0] & /*_style*/ 134217728) {
    			$$invalidate(10, style = _style());
    		}

    		if ($$self.$$.dirty[0] & /*init, type*/ 5) {
    			$$invalidate(6, sticky = init.sticky && type == "key");
    		}

    		if ($$self.$$.dirty[0] & /*features*/ 1048576) {
    			$$invalidate(28, sorting = features?.sortable?.key);
    		}

    		if ($$self.$$.dirty[0] & /*sticky, sorting, type, width*/ 268435556) {
    			$$invalidate(11, tdStyle = `
		vertical-align:middle;
		margin:0;
		padding:0;
		${sticky ? "position:sticky;top:0;" : "position:relative;"}
		${sorting && type == "key" ? "cursor:pointer" : ""}
		${width
			? `width:${isNaN(width) ? width : width + "px"};`
			: ""}`);
    		}

    		hasSlot = $$props.$$slots;

    		if ($$self.$$.dirty[0] & /*id, item, key, cellIndex, rowIndex, type*/ 62914566) {
    			$$invalidate(7, obj = {
    				id,
    				item,
    				key,
    				value: item[key],
    				cellIndex,
    				rowIndex,
    				type
    			});
    		}

    		if ($$self.$$.dirty[0] & /*callbacks*/ 524288) {
    			$$invalidate(29, cbs = callbacks || {});
    		}

    		if ($$self.$$.dirty[0] & /*cbs, type*/ 536870916) {
    			$$invalidate(8, renderFunc = (cbs.render || {})[type] || defaults.render);
    		}

    		if ($$self.$$.dirty[0] & /*cbs, type*/ 536870916) {
    			clickFunc = (cbs.click || {})[type] || defaults.click;
    		}

    		if ($$self.$$.dirty[0] & /*cbs, type*/ 536870916) {
    			dblClickFunc = (cbs.dblclick || {})[type] || defaults.dblclick;
    		}

    		if ($$self.$$.dirty[0] & /*features*/ 1048576) {
    			$$invalidate(12, direction = features?.sortable?.direction);
    		}

    		if ($$self.$$.dirty[0] & /*sorting, key*/ 268435458) {
    			$$invalidate(13, same = sorting == key);
    		}

    		if ($$self.$$.dirty[0] & /*renderFunc*/ 256) {
    			$$invalidate(9, component = Object.getOwnPropertyNames(renderFunc).indexOf("prototype") != -1);
    		}

    		if ($$self.$$.dirty[0] & /*component, renderFunc, obj, _refresh*/ 67109760) {
    			$$invalidate(14, render = component ? null : (renderFunc(obj) || "") + _refresh);
    		}
    	};

    	$$props = exclude_internal_props($$props);

    	return [
    		init,
    		key,
    		type,
    		colspan,
    		class_,
    		width,
    		sticky,
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
    		rowIndex,
    		cellIndex,
    		_refresh,
    		_style,
    		sorting,
    		cbs,
    		$$scope,
    		slots,
    		click_handler,
    		click_handler_1
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
    				dimensions: 17,
    				debug: 18,
    				callbacks: 19,
    				features: 20,
    				misc: 21,
    				id: 22,
    				item: 23,
    				key: 1,
    				rowIndex: 24,
    				cellIndex: 25,
    				type: 2,
    				colspan: 3,
    				class: 4
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

    		if (/*dimensions*/ ctx[17] === undefined && !("dimensions" in props)) {
    			console.warn("<Td> was created without expected prop 'dimensions'");
    		}

    		if (/*debug*/ ctx[18] === undefined && !("debug" in props)) {
    			console.warn("<Td> was created without expected prop 'debug'");
    		}

    		if (/*callbacks*/ ctx[19] === undefined && !("callbacks" in props)) {
    			console.warn("<Td> was created without expected prop 'callbacks'");
    		}

    		if (/*features*/ ctx[20] === undefined && !("features" in props)) {
    			console.warn("<Td> was created without expected prop 'features'");
    		}

    		if (/*misc*/ ctx[21] === undefined && !("misc" in props)) {
    			console.warn("<Td> was created without expected prop 'misc'");
    		}

    		if (/*id*/ ctx[22] === undefined && !("id" in props)) {
    			console.warn("<Td> was created without expected prop 'id'");
    		}

    		if (/*item*/ ctx[23] === undefined && !("item" in props)) {
    			console.warn("<Td> was created without expected prop 'item'");
    		}

    		if (/*key*/ ctx[1] === undefined && !("key" in props)) {
    			console.warn("<Td> was created without expected prop 'key'");
    		}

    		if (/*rowIndex*/ ctx[24] === undefined && !("rowIndex" in props)) {
    			console.warn("<Td> was created without expected prop 'rowIndex'");
    		}

    		if (/*cellIndex*/ ctx[25] === undefined && !("cellIndex" in props)) {
    			console.warn("<Td> was created without expected prop 'cellIndex'");
    		}

    		if (/*type*/ ctx[2] === undefined && !("type" in props)) {
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

    	get rowIndex() {
    		throw new Error("<Td>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rowIndex(value) {
    		throw new Error("<Td>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get cellIndex() {
    		throw new Error("<Td>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set cellIndex(value) {
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

    /* node_modules/.pnpm/svelte-tabular-table@1.0.6/node_modules/svelte-tabular-table/src/Tr.svelte generated by Svelte v3.38.2 */

    const { Object: Object_1$2 } = globals;
    const file$2 = "node_modules/.pnpm/svelte-tabular-table@1.0.6/node_modules/svelte-tabular-table/src/Tr.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[29] = list[i];
    	child_ctx[31] = i;
    	return child_ctx;
    }

    // (101:0) {:else}
    function create_else_block$1(ctx) {
    	let tr;
    	let t0;
    	let t1;
    	let tr_class_value;
    	let tr_data_key_value;
    	let current;
    	let if_block0 = /*features*/ ctx[0].checkable && create_if_block_3$1(ctx);
    	let if_block1 = /*features*/ ctx[0].rearrangeable && create_if_block_1$1(ctx);
    	let each_value = /*keys*/ ctx[12];
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

    			attr_dev(tr, "class", tr_class_value = "stt-" + slugify(/*id*/ ctx[11]) + /*getClasses*/ ctx[17](/*classes*/ ctx[9]));
    			attr_dev(tr, "data-key", tr_data_key_value = slugify(/*id*/ ctx[11]));
    			attr_dev(tr, "style", /*style*/ ctx[19]);
    			toggle_class(tr, "stt-checked", /*checked*/ ctx[15]);
    			toggle_class(tr, "stt-rearrangeable", /*features*/ ctx[0].rearrangeable);
    			add_location(tr, file$2, 101, 1, 2045);
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

    			/*tr_binding_1*/ ctx[26](tr);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*features*/ ctx[0].checkable) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty[0] & /*features*/ 1) {
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

    					if (dirty[0] & /*features*/ 1) {
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

    			if (dirty[0] & /*init, dimensions, debug, callbacks, features, misc, id, item, keys, type, rowIndex, offset*/ 14847) {
    				each_value = /*keys*/ ctx[12];
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

    			if (!current || dirty[0] & /*id, classes*/ 2560 && tr_class_value !== (tr_class_value = "stt-" + slugify(/*id*/ ctx[11]) + /*getClasses*/ ctx[17](/*classes*/ ctx[9]))) {
    				attr_dev(tr, "class", tr_class_value);
    			}

    			if (!current || dirty[0] & /*id*/ 2048 && tr_data_key_value !== (tr_data_key_value = slugify(/*id*/ ctx[11]))) {
    				attr_dev(tr, "data-key", tr_data_key_value);
    			}

    			if (dirty[0] & /*id, classes, checked*/ 35328) {
    				toggle_class(tr, "stt-checked", /*checked*/ ctx[15]);
    			}

    			if (dirty[0] & /*id, classes, features*/ 2561) {
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
    			/*tr_binding_1*/ ctx[26](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(101:0) {:else}",
    		ctx
    	});

    	return block;
    }

    // (76:0) {#if misc.hidden[ id ] || !misc.inited }
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
    				id: /*id*/ ctx[11],
    				item: /*item*/ ctx[6],
    				type: /*type*/ ctx[7],
    				colspan: /*colspan*/ ctx[14],
    				rowIndex: /*rowIndex*/ ctx[8],
    				cellIndex: -1,
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
    			attr_dev(tr, "class", tr_class_value = "stt-" + slugify(/*id*/ ctx[11]));
    			attr_dev(tr, "data-key", tr_data_key_value = slugify(/*id*/ ctx[11]));
    			attr_dev(tr, "style", /*style*/ ctx[19]);
    			toggle_class(tr, "stt-hidden", true);
    			add_location(tr, file$2, 77, 1, 1612);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, tr, anchor);
    			mount_component(td, tr, null);
    			/*tr_binding*/ ctx[21](tr);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const td_changes = {};
    			if (dirty[0] & /*init*/ 4) td_changes.init = /*init*/ ctx[2];
    			if (dirty[0] & /*dimensions*/ 8) td_changes.dimensions = /*dimensions*/ ctx[3];
    			if (dirty[0] & /*debug*/ 16) td_changes.debug = /*debug*/ ctx[4];
    			if (dirty[0] & /*callbacks*/ 32) td_changes.callbacks = /*callbacks*/ ctx[5];
    			if (dirty[0] & /*features*/ 1) td_changes.features = /*features*/ ctx[0];
    			if (dirty[0] & /*misc*/ 2) td_changes.misc = /*misc*/ ctx[1];
    			if (dirty[0] & /*id*/ 2048) td_changes.id = /*id*/ ctx[11];
    			if (dirty[0] & /*item*/ 64) td_changes.item = /*item*/ ctx[6];
    			if (dirty[0] & /*type*/ 128) td_changes.type = /*type*/ ctx[7];
    			if (dirty[0] & /*colspan*/ 16384) td_changes.colspan = /*colspan*/ ctx[14];
    			if (dirty[0] & /*rowIndex*/ 256) td_changes.rowIndex = /*rowIndex*/ ctx[8];

    			if (dirty[0] & /*dimensions*/ 8 | dirty[1] & /*$$scope*/ 2) {
    				td_changes.$$scope = { dirty, ctx };
    			}

    			td.$set(td_changes);

    			if (!current || dirty[0] & /*id*/ 2048 && tr_class_value !== (tr_class_value = "stt-" + slugify(/*id*/ ctx[11]))) {
    				attr_dev(tr, "class", tr_class_value);
    			}

    			if (!current || dirty[0] & /*id*/ 2048 && tr_data_key_value !== (tr_data_key_value = slugify(/*id*/ ctx[11]))) {
    				attr_dev(tr, "data-key", tr_data_key_value);
    			}

    			if (dirty[0] & /*id*/ 2048) {
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
    			/*tr_binding*/ ctx[21](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(76:0) {#if misc.hidden[ id ] || !misc.inited }",
    		ctx
    	});

    	return block;
    }

    // (109:2) {#if features.checkable}
    function create_if_block_3$1(ctx) {
    	let td;
    	let updating_features;
    	let current;

    	function td_features_binding(value) {
    		/*td_features_binding*/ ctx[23](value);
    	}

    	let td_props = {
    		init: /*init*/ ctx[2],
    		dimensions: /*dimensions*/ ctx[3],
    		debug: /*debug*/ ctx[4],
    		callbacks: /*callbacks*/ ctx[5],
    		misc: /*misc*/ ctx[1],
    		id: /*id*/ ctx[11],
    		item: /*item*/ ctx[6],
    		type: /*type*/ ctx[7],
    		cellIndex: 0,
    		rowIndex: /*rowIndex*/ ctx[8],
    		key: "stt-checkable-cell",
    		$$slots: { default: [create_default_slot_2] },
    		$$scope: { ctx }
    	};

    	if (/*features*/ ctx[0] !== void 0) {
    		td_props.features = /*features*/ ctx[0];
    	}

    	td = new Td({ props: td_props, $$inline: true });
    	binding_callbacks.push(() => bind(td, "features", td_features_binding));

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
    			if (dirty[0] & /*init*/ 4) td_changes.init = /*init*/ ctx[2];
    			if (dirty[0] & /*dimensions*/ 8) td_changes.dimensions = /*dimensions*/ ctx[3];
    			if (dirty[0] & /*debug*/ 16) td_changes.debug = /*debug*/ ctx[4];
    			if (dirty[0] & /*callbacks*/ 32) td_changes.callbacks = /*callbacks*/ ctx[5];
    			if (dirty[0] & /*misc*/ 2) td_changes.misc = /*misc*/ ctx[1];
    			if (dirty[0] & /*id*/ 2048) td_changes.id = /*id*/ ctx[11];
    			if (dirty[0] & /*item*/ 64) td_changes.item = /*item*/ ctx[6];
    			if (dirty[0] & /*type*/ 128) td_changes.type = /*type*/ ctx[7];
    			if (dirty[0] & /*rowIndex*/ 256) td_changes.rowIndex = /*rowIndex*/ ctx[8];

    			if (dirty[0] & /*indeterminate, features, id*/ 3073 | dirty[1] & /*$$scope*/ 2) {
    				td_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_features && dirty[0] & /*features*/ 1) {
    				updating_features = true;
    				td_changes.features = /*features*/ ctx[0];
    				add_flush_callback(() => updating_features = false);
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
    		source: "(109:2) {#if features.checkable}",
    		ctx
    	});

    	return block;
    }

    // (110:3) <Td      {init}      {dimensions}      {debug}      {callbacks}      bind:features={features}      {misc}      {id}      {item}      {type}      cellIndex={ 0 }     {rowIndex}     key={'stt-checkable-cell'}>
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
    			input.indeterminate = /*indeterminate*/ ctx[10];
    			add_location(input, file$2, 125, 5, 2571);
    			add_location(span, file$2, 129, 5, 2702);
    			attr_dev(label, "class", "checkbox stt-checkbox");
    			attr_dev(label, "style", /*special*/ ctx[18]);
    			add_location(label, file$2, 122, 4, 2501);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, input);
    			input.checked = /*features*/ ctx[0].checkable[/*id*/ ctx[11]];
    			append_dev(label, t);
    			append_dev(label, span);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "change", /*input_change_handler*/ ctx[22]),
    					listen_dev(input, "change", /*onChecked*/ ctx[16], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*indeterminate*/ 1024) {
    				prop_dev(input, "indeterminate", /*indeterminate*/ ctx[10]);
    			}

    			if (dirty[0] & /*features, id*/ 2049) {
    				input.checked = /*features*/ ctx[0].checkable[/*id*/ ctx[11]];
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
    		source: "(110:3) <Td      {init}      {dimensions}      {debug}      {callbacks}      bind:features={features}      {misc}      {id}      {item}      {type}      cellIndex={ 0 }     {rowIndex}     key={'stt-checkable-cell'}>",
    		ctx
    	});

    	return block;
    }

    // (135:2) {#if features.rearrangeable}
    function create_if_block_1$1(ctx) {
    	let td;
    	let updating_features;
    	let current;

    	function td_features_binding_1(value) {
    		/*td_features_binding_1*/ ctx[25](value);
    	}

    	let td_props = {
    		init: /*init*/ ctx[2],
    		dimensions: /*dimensions*/ ctx[3],
    		debug: /*debug*/ ctx[4],
    		callbacks: /*callbacks*/ ctx[5],
    		misc: /*misc*/ ctx[1],
    		id: /*id*/ ctx[11],
    		item: /*item*/ ctx[6],
    		type: /*type*/ ctx[7],
    		cellIndex: /*offset*/ ctx[13] - 1,
    		rowIndex: /*rowIndex*/ ctx[8],
    		key: "stt-rearrangeable-cell",
    		$$slots: { default: [create_default_slot_1] },
    		$$scope: { ctx }
    	};

    	if (/*features*/ ctx[0] !== void 0) {
    		td_props.features = /*features*/ ctx[0];
    	}

    	td = new Td({ props: td_props, $$inline: true });
    	binding_callbacks.push(() => bind(td, "features", td_features_binding_1));

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
    			if (dirty[0] & /*init*/ 4) td_changes.init = /*init*/ ctx[2];
    			if (dirty[0] & /*dimensions*/ 8) td_changes.dimensions = /*dimensions*/ ctx[3];
    			if (dirty[0] & /*debug*/ 16) td_changes.debug = /*debug*/ ctx[4];
    			if (dirty[0] & /*callbacks*/ 32) td_changes.callbacks = /*callbacks*/ ctx[5];
    			if (dirty[0] & /*misc*/ 2) td_changes.misc = /*misc*/ ctx[1];
    			if (dirty[0] & /*id*/ 2048) td_changes.id = /*id*/ ctx[11];
    			if (dirty[0] & /*item*/ 64) td_changes.item = /*item*/ ctx[6];
    			if (dirty[0] & /*type*/ 128) td_changes.type = /*type*/ ctx[7];
    			if (dirty[0] & /*offset*/ 8192) td_changes.cellIndex = /*offset*/ ctx[13] - 1;
    			if (dirty[0] & /*rowIndex*/ 256) td_changes.rowIndex = /*rowIndex*/ ctx[8];

    			if (dirty[0] & /*misc, id, type*/ 2178 | dirty[1] & /*$$scope*/ 2) {
    				td_changes.$$scope = { dirty, ctx };
    			}

    			if (!updating_features && dirty[0] & /*features*/ 1) {
    				updating_features = true;
    				td_changes.features = /*features*/ ctx[0];
    				add_flush_callback(() => updating_features = false);
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
    		source: "(135:2) {#if features.rearrangeable}",
    		ctx
    	});

    	return block;
    }

    // (149:4) {#if type != 'key'}
    function create_if_block_2$1(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text("|||");
    			attr_dev(div, "style", /*special*/ ctx[18]);
    			add_location(div, file$2, 149, 5, 3025);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    			/*div_binding*/ ctx[24](div);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[24](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(149:4) {#if type != 'key'}",
    		ctx
    	});

    	return block;
    }

    // (136:3) <Td      {init}      {dimensions}      {debug}      {callbacks}      bind:features={features}      {misc}      {id}      {item}      {type}     cellIndex={ offset - 1 }     {rowIndex}     key={'stt-rearrangeable-cell'}>
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
    		source: "(136:3) <Td      {init}      {dimensions}      {debug}      {callbacks}      bind:features={features}      {misc}      {id}      {item}      {type}     cellIndex={ offset - 1 }     {rowIndex}     key={'stt-rearrangeable-cell'}>",
    		ctx
    	});

    	return block;
    }

    // (155:2) {#each keys as key, idx}
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
    				id: /*id*/ ctx[11],
    				item: /*item*/ ctx[6],
    				key: /*key*/ ctx[29],
    				type: /*type*/ ctx[7],
    				rowIndex: /*rowIndex*/ ctx[8],
    				cellIndex: /*offset*/ ctx[13] + /*idx*/ ctx[31]
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
    			if (dirty[0] & /*init*/ 4) td_changes.init = /*init*/ ctx[2];
    			if (dirty[0] & /*dimensions*/ 8) td_changes.dimensions = /*dimensions*/ ctx[3];
    			if (dirty[0] & /*debug*/ 16) td_changes.debug = /*debug*/ ctx[4];
    			if (dirty[0] & /*callbacks*/ 32) td_changes.callbacks = /*callbacks*/ ctx[5];
    			if (dirty[0] & /*features*/ 1) td_changes.features = /*features*/ ctx[0];
    			if (dirty[0] & /*misc*/ 2) td_changes.misc = /*misc*/ ctx[1];
    			if (dirty[0] & /*id*/ 2048) td_changes.id = /*id*/ ctx[11];
    			if (dirty[0] & /*item*/ 64) td_changes.item = /*item*/ ctx[6];
    			if (dirty[0] & /*keys*/ 4096) td_changes.key = /*key*/ ctx[29];
    			if (dirty[0] & /*type*/ 128) td_changes.type = /*type*/ ctx[7];
    			if (dirty[0] & /*rowIndex*/ 256) td_changes.rowIndex = /*rowIndex*/ ctx[8];
    			if (dirty[0] & /*offset*/ 8192) td_changes.cellIndex = /*offset*/ ctx[13] + /*idx*/ ctx[31];
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
    		source: "(155:2) {#each keys as key, idx}",
    		ctx
    	});

    	return block;
    }

    // (83:2) <Td     {init}     {dimensions}     {debug}     {callbacks}     {features}     {misc}     {id}     {item}     {type}     {colspan}    {rowIndex}    cellIndex={ -1 }    key={'stt-hidden-cell'}>
    function create_default_slot(ctx) {
    	let div;
    	let div_style_value;

    	const block = {
    		c: function create() {
    			div = element("div");

    			attr_dev(div, "style", div_style_value = `height: ${/*dimensions*/ ctx[3].row
			? /*dimensions*/ ctx[3].row + "px"
			: "auto"}`);

    			add_location(div, file$2, 96, 3, 1943);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*dimensions*/ 8 && div_style_value !== (div_style_value = `height: ${/*dimensions*/ ctx[3].row
			? /*dimensions*/ ctx[3].row + "px"
			: "auto"}`)) {
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
    		source: "(83:2) <Td     {init}     {dimensions}     {debug}     {callbacks}     {features}     {misc}     {id}     {item}     {type}     {colspan}    {rowIndex}    cellIndex={ -1 }    key={'stt-hidden-cell'}>",
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
    		if (/*misc*/ ctx[1].hidden[/*id*/ ctx[11]] || !/*misc*/ ctx[1].inited) return 0;
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
    	let { rowIndex } = $$props;
    	let { classes = {} } = $$props;
    	let { indeterminate = false } = $$props;

    	function setChecked(id, event) {
    		(callbacks?.checked || defaults.checked)({ id, event, checkable: features.checkable });
    		$$invalidate(0, features.checkable[id] = event.target.checked, features);
    	}

    	function onChecked(event) {
    		if (type == "key") {
    			for (let i = 0; i < init.data.length; i++) {
    				const id = init.data[i][init.index];
    				setChecked(id, event);
    			}
    		} else {
    			setChecked(id, event);
    		}
    	}

    	function getClasses(classes_) {
    		let classStr = "";

    		for (const [c, arr] of Object.entries(classes_)) {
    			if ((arr || []).indexOf(id) != -1 && id != undefined) {
    				classStr += " " + c;
    			}
    		}

    		return classStr;
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
    		"rowIndex",
    		"classes",
    		"indeterminate"
    	];

    	Object_1$2.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Tr> was created with unknown prop '${key}'`);
    	});

    	function tr_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			misc.els.tr[id] = $$value;
    			$$invalidate(1, misc);
    			(($$invalidate(11, id), $$invalidate(6, item)), $$invalidate(2, init));
    		});
    	}

    	function input_change_handler() {
    		features.checkable[id] = this.checked;
    		$$invalidate(0, features);
    		(($$invalidate(11, id), $$invalidate(6, item)), $$invalidate(2, init));
    	}

    	function td_features_binding(value) {
    		features = value;
    		$$invalidate(0, features);
    	}

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			misc.els.handles[id] = $$value;
    			$$invalidate(1, misc);
    			(($$invalidate(11, id), $$invalidate(6, item)), $$invalidate(2, init));
    		});
    	}

    	function td_features_binding_1(value) {
    		features = value;
    		$$invalidate(0, features);
    	}

    	function tr_binding_1($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			misc.els.tr[id] = $$value;
    			$$invalidate(1, misc);
    			(($$invalidate(11, id), $$invalidate(6, item)), $$invalidate(2, init));
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
    		if ("rowIndex" in $$props) $$invalidate(8, rowIndex = $$props.rowIndex);
    		if ("classes" in $$props) $$invalidate(9, classes = $$props.classes);
    		if ("indeterminate" in $$props) $$invalidate(10, indeterminate = $$props.indeterminate);
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
    		rowIndex,
    		classes,
    		indeterminate,
    		setChecked,
    		onChecked,
    		getClasses,
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
    		if ("rowIndex" in $$props) $$invalidate(8, rowIndex = $$props.rowIndex);
    		if ("classes" in $$props) $$invalidate(9, classes = $$props.classes);
    		if ("indeterminate" in $$props) $$invalidate(10, indeterminate = $$props.indeterminate);
    		if ("style" in $$props) $$invalidate(19, style = $$props.style);
    		if ("id" in $$props) $$invalidate(11, id = $$props.id);
    		if ("total" in $$props) $$invalidate(20, total = $$props.total);
    		if ("offset" in $$props) $$invalidate(13, offset = $$props.offset);
    		if ("keys" in $$props) $$invalidate(12, keys = $$props.keys);
    		if ("colspan" in $$props) $$invalidate(14, colspan = $$props.colspan);
    		if ("checked" in $$props) $$invalidate(15, checked = $$props.checked);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*item, init*/ 68) {
    			$$invalidate(11, id = item[init?.index] || init.data.indexOf(item));
    		}

    		if ($$self.$$.dirty[0] & /*init*/ 4) {
    			$$invalidate(12, keys = init.keys || []);
    		}

    		if ($$self.$$.dirty[0] & /*total, keys*/ 1052672) {
    			$$invalidate(13, offset = total - keys.length);
    		}

    		if ($$self.$$.dirty[0] & /*total*/ 1048576) {
    			$$invalidate(14, colspan = total);
    		}

    		if ($$self.$$.dirty[0] & /*features, id*/ 2049) {
    			$$invalidate(15, checked = (features?.checkable || {})[id]);
    		}
    	};

    	$$invalidate(20, total = _total());

    	return [
    		features,
    		misc,
    		init,
    		dimensions,
    		debug,
    		callbacks,
    		item,
    		type,
    		rowIndex,
    		classes,
    		indeterminate,
    		id,
    		keys,
    		offset,
    		colspan,
    		checked,
    		onChecked,
    		getClasses,
    		special,
    		style,
    		total,
    		tr_binding,
    		input_change_handler,
    		td_features_binding,
    		div_binding,
    		td_features_binding_1,
    		tr_binding_1
    	];
    }

    class Tr extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(
    			this,
    			options,
    			instance$2,
    			create_fragment$2,
    			safe_not_equal,
    			{
    				init: 2,
    				dimensions: 3,
    				debug: 4,
    				callbacks: 5,
    				features: 0,
    				misc: 1,
    				item: 6,
    				type: 7,
    				rowIndex: 8,
    				classes: 9,
    				indeterminate: 10
    			},
    			[-1, -1]
    		);

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

    		if (/*rowIndex*/ ctx[8] === undefined && !("rowIndex" in props)) {
    			console.warn("<Tr> was created without expected prop 'rowIndex'");
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

    	get rowIndex() {
    		throw new Error("<Tr>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set rowIndex(value) {
    		throw new Error("<Tr>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get classes() {
    		throw new Error("<Tr>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set classes(value) {
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

    /* node_modules/.pnpm/svelte-tabular-table@1.0.6/node_modules/svelte-tabular-table/src/Table.svelte generated by Svelte v3.38.2 */

    const { Object: Object_1$1, console: console_1$1 } = globals;
    const file$1 = "node_modules/.pnpm/svelte-tabular-table@1.0.6/node_modules/svelte-tabular-table/src/Table.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[33] = list[i];
    	child_ctx[35] = i;
    	return child_ctx;
    }

    // (321:1) {#if !init.nohead}
    function create_if_block$1(ctx) {
    	let thead_1;
    	let tr;
    	let updating_features;
    	let current;

    	function tr_features_binding(value) {
    		/*tr_features_binding*/ ctx[15](value);
    	}

    	let tr_props = {
    		init: /*init*/ ctx[0],
    		dimensions: /*dimensions*/ ctx[1],
    		debug: /*debug*/ ctx[4],
    		callbacks: /*callbacks*/ ctx[7],
    		misc: /*misc*/ ctx[8],
    		item: /*thead*/ ctx[11],
    		type: "key",
    		indeterminate: /*indeterminate*/ ctx[9],
    		rowIndex: -1
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
    			add_location(thead_1, file$1, 321, 2, 8243);
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
    			if (dirty[0] & /*callbacks*/ 128) tr_changes.callbacks = /*callbacks*/ ctx[7];
    			if (dirty[0] & /*misc*/ 256) tr_changes.misc = /*misc*/ ctx[8];
    			if (dirty[0] & /*thead*/ 2048) tr_changes.item = /*thead*/ ctx[11];
    			if (dirty[0] & /*indeterminate*/ 512) tr_changes.indeterminate = /*indeterminate*/ ctx[9];

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
    		source: "(321:1) {#if !init.nohead}",
    		ctx
    	});

    	return block;
    }

    // (330:2) {#each data as item, idx }
    function create_each_block$1(ctx) {
    	let tr;
    	let updating_features;
    	let current;

    	function tr_features_binding_1(value) {
    		/*tr_features_binding_1*/ ctx[16](value);
    	}

    	let tr_props = {
    		init: /*init*/ ctx[0],
    		classes: /*classes*/ ctx[6],
    		dimensions: /*dimensions*/ ctx[1],
    		debug: /*debug*/ ctx[4],
    		callbacks: /*callbacks*/ ctx[7],
    		misc: /*misc*/ ctx[8],
    		item: /*item*/ ctx[33],
    		rowIndex: /*idx*/ ctx[35],
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
    			if (dirty[0] & /*classes*/ 64) tr_changes.classes = /*classes*/ ctx[6];
    			if (dirty[0] & /*dimensions*/ 2) tr_changes.dimensions = /*dimensions*/ ctx[1];
    			if (dirty[0] & /*debug*/ 16) tr_changes.debug = /*debug*/ ctx[4];
    			if (dirty[0] & /*callbacks*/ 128) tr_changes.callbacks = /*callbacks*/ ctx[7];
    			if (dirty[0] & /*misc*/ 256) tr_changes.misc = /*misc*/ ctx[8];
    			if (dirty[0] & /*data*/ 1024) tr_changes.item = /*item*/ ctx[33];

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
    		source: "(330:2) {#each data as item, idx }",
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
    	let each_value = /*data*/ ctx[10];
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

    			add_location(tbody, file$1, 328, 1, 8411);
    			attr_dev(table, "id", table_id_value = "stt-" + slugify(/*id*/ ctx[5]));
    			attr_dev(table, "class", table_class_value = /*class_*/ ctx[3] + " stt-" + slugify(/*id*/ ctx[5]));
    			attr_dev(table, "data-id", table_data_id_value = slugify(/*id*/ ctx[5]));
    			attr_dev(table, "style", /*allStyles*/ ctx[12]);
    			add_location(table, file$1, 313, 0, 8067);
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

    			/*table_binding*/ ctx[17](table);
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

    			if (dirty[0] & /*init, classes, dimensions, debug, callbacks, misc, data, features*/ 1495) {
    				each_value = /*data*/ ctx[10];
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

    			if (!current || dirty[0] & /*allStyles*/ 4096) {
    				attr_dev(table, "style", /*allStyles*/ ctx[12]);
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
    			/*table_binding*/ ctx[17](null);
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
    	let tableLayout;
    	let allStyles;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Table", slots, []);
    	const dispatch = createEventDispatcher();

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

    				// warn(`no property "${init.index}" in data item ${i}, defaulting to "${id}"`)
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
    		if (activ) warn(`${init_?.name || ""} ${tally.duped}/${len} duplicate keys amended, ${tally.added}/${len} keys added`);

    		if (!features.autohide) {
    			misc.inited = true;
    			dispatch("inited");
    		}
    	}

    	let { class: class_ = "" } = $$props;
    	let { style: style_ = "" } = $$props;

    	let { init = {
    		name: "table",
    		keys: [], // array of text or array of objects
    		data: [],
    		index: null,
    		nohead: false,
    		nodiv: false
    	} } = $$props;

    	let { dimensions = { ...defaults.dimensions } } = $$props;
    	let { debug = false } = $$props;
    	let { id = "table" } = $$props;

    	onMount(async () => {
    		
    	});

    	let { classes = {} } = $$props;

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
    		checked: defaults.checked,
    		sort: defaults.sort
    	} } = $$props;

    	let { features = {
    		sortable: { key: null, direction: false },
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
    		if (autohide && dimensions?.row == undefined) $$invalidate(1, dimensions.row = defaults.dimensions.row, dimensions);
    		if (autohide && dimensions?.padding == undefined) $$invalidate(1, dimensions.padding = defaults.dimensions.padding, dimensions);

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
    			$$invalidate(8, misc.hidden[id] = false, misc);
    			const thead = init.nohead ? 0 : height;
    			const piece = height * i + height + thead;
    			const above = scroll > piece + off + extra;
    			const below = piece + off > scroll + outside + extra;
    			if ((above || below) && exists) $$invalidate(8, misc.hidden[id] = true, misc);

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

    		if (exists && debug) {
    			log(`${outside}px container: ${tally.above}/${len} above, ${tally.below}/${len} below, from ${tally.first} to ${tally.last}, ${len - (tally.above + tally.below)}/${len} visible, using height ${height}px`);
    		}

    		if (exists) {
    			$$invalidate(8, misc.inited = true, misc);
    			dispatch("inited");
    		}
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

    		if (!yes && no) return $$invalidate(9, indeterminate = false);
    		if (yes && !no) return $$invalidate(9, indeterminate = false);
    		return $$invalidate(9, indeterminate = true);
    	}

    	function getSorted(_sortable, _id) {
    		const s = sort(_sortable, [...init.data], _id);
    		setTimeout(triggerScroll, 1);
    		return s;
    	}

    	const writable_props = [
    		"class",
    		"style",
    		"init",
    		"dimensions",
    		"debug",
    		"id",
    		"classes",
    		"callbacks",
    		"features"
    	];

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
    			$$invalidate(8, misc);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("class" in $$props) $$invalidate(3, class_ = $$props.class);
    		if ("style" in $$props) $$invalidate(13, style_ = $$props.style);
    		if ("init" in $$props) $$invalidate(0, init = $$props.init);
    		if ("dimensions" in $$props) $$invalidate(1, dimensions = $$props.dimensions);
    		if ("debug" in $$props) $$invalidate(4, debug = $$props.debug);
    		if ("id" in $$props) $$invalidate(5, id = $$props.id);
    		if ("classes" in $$props) $$invalidate(6, classes = $$props.classes);
    		if ("callbacks" in $$props) $$invalidate(7, callbacks = $$props.callbacks);
    		if ("features" in $$props) $$invalidate(2, features = $$props.features);
    	};

    	$$self.$capture_state = () => ({
    		Tr,
    		Td,
    		onMount,
    		onDestroy,
    		queryString,
    		dragdrop: dragdrop$1,
    		fade,
    		defaults,
    		slugify,
    		createEventDispatcher,
    		dispatch,
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
    		classes,
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
    		tableLayout,
    		allStyles
    	});

    	$$self.$inject_state = $$props => {
    		if ("class_" in $$props) $$invalidate(3, class_ = $$props.class_);
    		if ("style_" in $$props) $$invalidate(13, style_ = $$props.style_);
    		if ("init" in $$props) $$invalidate(0, init = $$props.init);
    		if ("dimensions" in $$props) $$invalidate(1, dimensions = $$props.dimensions);
    		if ("debug" in $$props) $$invalidate(4, debug = $$props.debug);
    		if ("id" in $$props) $$invalidate(5, id = $$props.id);
    		if ("classes" in $$props) $$invalidate(6, classes = $$props.classes);
    		if ("callbacks" in $$props) $$invalidate(7, callbacks = $$props.callbacks);
    		if ("features" in $$props) $$invalidate(2, features = $$props.features);
    		if ("misc" in $$props) $$invalidate(8, misc = $$props.misc);
    		if ("hasDragDrop" in $$props) hasDragDrop = $$props.hasDragDrop;
    		if ("aboveY" in $$props) aboveY = $$props.aboveY;
    		if ("belowY" in $$props) belowY = $$props.belowY;
    		if ("bottomY" in $$props) bottomY = $$props.bottomY;
    		if ("indeterminate" in $$props) $$invalidate(9, indeterminate = $$props.indeterminate);
    		if ("rev" in $$props) rev = $$props.rev;
    		if ("data" in $$props) $$invalidate(10, data = $$props.data);
    		if ("thead" in $$props) $$invalidate(11, thead = $$props.thead);
    		if ("sort" in $$props) sort = $$props.sort;
    		if ("tableLayout" in $$props) $$invalidate(14, tableLayout = $$props.tableLayout);
    		if ("allStyles" in $$props) $$invalidate(12, allStyles = $$props.allStyles);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*init, dimensions, callbacks, features, misc*/ 391) {
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

    		if ($$self.$$.dirty[0] & /*callbacks*/ 128) {
    			sort = callbacks?.sort || defaults.sort;
    		}

    		if ($$self.$$.dirty[0] & /*features, id, init*/ 37) {
    			$$invalidate(10, data = (features?.sortable?.key)
    			? getSorted(features.sortable, id)
    			: init.data);
    		}

    		if ($$self.$$.dirty[0] & /*dimensions*/ 2) {
    			$$invalidate(14, tableLayout = dimensions.widths ? "table-layout:fixed;" : "");
    		}

    		if ($$self.$$.dirty[0] & /*dimensions, tableLayout, style_*/ 24578) {
    			$$invalidate(12, allStyles = `min-width:${dimensions.minwidth || "0"}px;width:100%;${tableLayout}border-spacing:0;${style_}`);
    		}
    	};

    	$$invalidate(11, thead = _thead());

    	return [
    		init,
    		dimensions,
    		features,
    		class_,
    		debug,
    		id,
    		classes,
    		callbacks,
    		misc,
    		indeterminate,
    		data,
    		thead,
    		allStyles,
    		style_,
    		tableLayout,
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
    				style: 13,
    				init: 0,
    				dimensions: 1,
    				debug: 4,
    				id: 5,
    				classes: 6,
    				callbacks: 7,
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

    	get classes() {
    		throw new Error("<Table>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set classes(value) {
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

    var svg = `
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg width="100%" height="100%" viewBox="0 0 827 945" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xml:space="preserve" xmlns:serif="http://www.serif.com/" style="fill-rule:evenodd;clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;">
    <g transform="matrix(1,0,0,1,-1094.91,-1418.59)">
        <g transform="matrix(0.789551,0.613685,-0.613685,0.789551,1192.6,-471.421)">
            <g transform="matrix(62.5,0,0,62.5,1283.65,1503.14)">
                <path d="M0.421,-0.167L0.512,-0.156C0.497,-0.103 0.471,-0.062 0.432,-0.032C0.393,-0.003 0.344,0.012 0.284,0.012C0.208,0.012 0.148,-0.012 0.103,-0.058C0.059,-0.105 0.037,-0.171 0.037,-0.255C0.037,-0.342 0.059,-0.41 0.104,-0.458C0.149,-0.506 0.207,-0.53 0.279,-0.53C0.348,-0.53 0.405,-0.507 0.449,-0.459C0.493,-0.412 0.515,-0.346 0.515,-0.26C0.515,-0.255 0.514,-0.247 0.514,-0.237L0.127,-0.237C0.131,-0.18 0.147,-0.136 0.176,-0.106C0.205,-0.076 0.241,-0.061 0.284,-0.061C0.316,-0.061 0.344,-0.069 0.367,-0.086C0.389,-0.103 0.408,-0.13 0.421,-0.167ZM0.132,-0.309L0.422,-0.309C0.418,-0.353 0.407,-0.385 0.389,-0.407C0.361,-0.441 0.324,-0.458 0.28,-0.458C0.239,-0.458 0.205,-0.444 0.178,-0.417C0.15,-0.39 0.135,-0.354 0.132,-0.309Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.672886,0.739746,-0.739746,0.672886,1602.95,-491.288)">
            <g transform="matrix(62.5,0,0,62.5,1356.98,1566.84)">
                <path d="M0.02,-0L0.02,-0.071L0.35,-0.45C0.312,-0.448 0.279,-0.447 0.25,-0.447L0.039,-0.447L0.039,-0.519L0.463,-0.519L0.463,-0.46L0.182,-0.131L0.128,-0.071C0.167,-0.074 0.204,-0.076 0.239,-0.076L0.479,-0.076L0.479,-0L0.02,-0Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.473507,0.88079,-0.88079,0.473507,2189.87,-382.686)">
            <g transform="matrix(62.5,0,0,62.5,1415.04,1640.41)">
                <path d="M0.421,-0.167L0.512,-0.156C0.497,-0.103 0.471,-0.062 0.432,-0.032C0.393,-0.003 0.344,0.012 0.284,0.012C0.208,0.012 0.148,-0.012 0.103,-0.058C0.059,-0.105 0.037,-0.171 0.037,-0.255C0.037,-0.342 0.059,-0.41 0.104,-0.458C0.149,-0.506 0.207,-0.53 0.279,-0.53C0.348,-0.53 0.405,-0.507 0.449,-0.459C0.493,-0.412 0.515,-0.346 0.515,-0.26C0.515,-0.255 0.514,-0.247 0.514,-0.237L0.127,-0.237C0.131,-0.18 0.147,-0.136 0.176,-0.106C0.205,-0.076 0.241,-0.061 0.284,-0.061C0.316,-0.061 0.344,-0.069 0.367,-0.086C0.389,-0.103 0.408,-0.13 0.421,-0.167ZM0.132,-0.309L0.422,-0.309C0.418,-0.353 0.407,-0.385 0.389,-0.407C0.361,-0.441 0.324,-0.458 0.28,-0.458C0.239,-0.458 0.205,-0.444 0.178,-0.417C0.15,-0.39 0.135,-0.354 0.132,-0.309Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.100716,0.994915,-0.994915,0.100716,3026.3,112.913)">
            <g transform="matrix(62.5,0,0,62.5,1450.69,1730.52)">
                <path d="M0.02,-0L0.02,-0.071L0.35,-0.45C0.312,-0.448 0.279,-0.447 0.25,-0.447L0.039,-0.447L0.039,-0.519L0.463,-0.519L0.463,-0.46L0.182,-0.131L0.128,-0.071C0.167,-0.074 0.204,-0.076 0.239,-0.076L0.479,-0.076L0.479,-0L0.02,-0Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(-0.367075,0.930191,-0.930191,-0.367075,3672.18,1148.56)">
            <g transform="matrix(62.5,0,0,62.5,1445.33,1823.6)">
                <path d="M0.421,-0.167L0.512,-0.156C0.497,-0.103 0.471,-0.062 0.432,-0.032C0.393,-0.003 0.344,0.012 0.284,0.012C0.208,0.012 0.148,-0.012 0.103,-0.058C0.059,-0.105 0.037,-0.171 0.037,-0.255C0.037,-0.342 0.059,-0.41 0.104,-0.458C0.149,-0.506 0.207,-0.53 0.279,-0.53C0.348,-0.53 0.405,-0.507 0.449,-0.459C0.493,-0.412 0.515,-0.346 0.515,-0.26C0.515,-0.255 0.514,-0.247 0.514,-0.237L0.127,-0.237C0.131,-0.18 0.147,-0.136 0.176,-0.106C0.205,-0.076 0.241,-0.061 0.284,-0.061C0.316,-0.061 0.344,-0.069 0.367,-0.086C0.389,-0.103 0.408,-0.13 0.421,-0.167ZM0.132,-0.309L0.422,-0.309C0.418,-0.353 0.407,-0.385 0.389,-0.407C0.361,-0.441 0.324,-0.458 0.28,-0.458C0.239,-0.458 0.205,-0.444 0.178,-0.417C0.15,-0.39 0.135,-0.354 0.132,-0.309Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(-0.66217,0.749354,-0.749354,-0.66217,3754.49,2123.88)">
            <g transform="matrix(62.5,0,0,62.5,1398.49,1908.25)">
                <path d="M0.02,-0L0.02,-0.071L0.35,-0.45C0.312,-0.448 0.279,-0.447 0.25,-0.447L0.039,-0.447L0.039,-0.519L0.463,-0.519L0.463,-0.46L0.182,-0.131L0.128,-0.071C0.167,-0.074 0.204,-0.076 0.239,-0.076L0.479,-0.076L0.479,-0L0.02,-0Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(-0.729515,0.683965,-0.683965,-0.729515,3653.36,2503.13)">
            <g transform="matrix(62.5,0,0,62.5,1331.73,1973.96)">
                <path d="M0.421,-0.167L0.512,-0.156C0.497,-0.103 0.471,-0.062 0.432,-0.032C0.393,-0.003 0.344,0.012 0.284,0.012C0.208,0.012 0.148,-0.012 0.103,-0.058C0.059,-0.105 0.037,-0.171 0.037,-0.255C0.037,-0.342 0.059,-0.41 0.104,-0.458C0.149,-0.506 0.207,-0.53 0.279,-0.53C0.348,-0.53 0.405,-0.507 0.449,-0.459C0.493,-0.412 0.515,-0.346 0.515,-0.26C0.515,-0.255 0.514,-0.247 0.514,-0.237L0.127,-0.237C0.131,-0.18 0.147,-0.136 0.176,-0.106C0.205,-0.076 0.241,-0.061 0.284,-0.061C0.316,-0.061 0.344,-0.069 0.367,-0.086C0.389,-0.103 0.408,-0.13 0.421,-0.167ZM0.132,-0.309L0.422,-0.309C0.418,-0.353 0.407,-0.385 0.389,-0.407C0.361,-0.441 0.324,-0.458 0.28,-0.458C0.239,-0.458 0.205,-0.444 0.178,-0.417C0.15,-0.39 0.135,-0.354 0.132,-0.309Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(-0.660093,0.751183,-0.751183,-0.660093,3630.35,2442.07)">
            <g transform="matrix(62.5,0,0,62.5,1262.66,2042.39)">
                <path d="M0.02,-0L0.02,-0.071L0.35,-0.45C0.312,-0.448 0.279,-0.447 0.25,-0.447L0.039,-0.447L0.039,-0.519L0.463,-0.519L0.463,-0.46L0.182,-0.131L0.128,-0.071C0.167,-0.074 0.204,-0.076 0.239,-0.076L0.479,-0.076L0.479,-0L0.02,-0Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(-0.503197,0.864172,-0.864172,-0.503197,3638.75,2139.61)">
            <g transform="matrix(62.5,0,0,62.5,1204.36,2115.74)">
                <path d="M0.421,-0.167L0.512,-0.156C0.497,-0.103 0.471,-0.062 0.432,-0.032C0.393,-0.003 0.344,0.012 0.284,0.012C0.208,0.012 0.148,-0.012 0.103,-0.058C0.059,-0.105 0.037,-0.171 0.037,-0.255C0.037,-0.342 0.059,-0.41 0.104,-0.458C0.149,-0.506 0.207,-0.53 0.279,-0.53C0.348,-0.53 0.405,-0.507 0.449,-0.459C0.493,-0.412 0.515,-0.346 0.515,-0.26C0.515,-0.255 0.514,-0.247 0.514,-0.237L0.127,-0.237C0.131,-0.18 0.147,-0.136 0.176,-0.106C0.205,-0.076 0.241,-0.061 0.284,-0.061C0.316,-0.061 0.344,-0.069 0.367,-0.086C0.389,-0.103 0.408,-0.13 0.421,-0.167ZM0.132,-0.309L0.422,-0.309C0.418,-0.353 0.407,-0.385 0.389,-0.407C0.361,-0.441 0.324,-0.458 0.28,-0.458C0.239,-0.458 0.205,-0.444 0.178,-0.417C0.15,-0.39 0.135,-0.354 0.132,-0.309Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.0561289,0.998424,-0.998424,0.0561289,3303.51,916.228)">
            <g transform="matrix(62.5,0,0,62.5,1167.16,2205.34)">
                <path d="M0.02,-0L0.02,-0.071L0.35,-0.45C0.312,-0.448 0.279,-0.447 0.25,-0.447L0.039,-0.447L0.039,-0.519L0.463,-0.519L0.463,-0.46L0.182,-0.131L0.128,-0.071C0.167,-0.074 0.204,-0.076 0.239,-0.076L0.479,-0.076L0.479,-0L0.02,-0Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.907369,0.420335,-0.420335,0.907369,1072.81,-295.093)">
            <g transform="matrix(62.5,0,0,62.5,1205.93,2286.52)">
                <path d="M0.421,-0.167L0.512,-0.156C0.497,-0.103 0.471,-0.062 0.432,-0.032C0.393,-0.003 0.344,0.012 0.284,0.012C0.208,0.012 0.148,-0.012 0.103,-0.058C0.059,-0.105 0.037,-0.171 0.037,-0.255C0.037,-0.342 0.059,-0.41 0.104,-0.458C0.149,-0.506 0.207,-0.53 0.279,-0.53C0.348,-0.53 0.405,-0.507 0.449,-0.459C0.493,-0.412 0.515,-0.346 0.515,-0.26C0.515,-0.255 0.514,-0.247 0.514,-0.237L0.127,-0.237C0.131,-0.18 0.147,-0.136 0.176,-0.106C0.205,-0.076 0.241,-0.061 0.284,-0.061C0.316,-0.061 0.344,-0.069 0.367,-0.086C0.389,-0.103 0.408,-0.13 0.421,-0.167ZM0.132,-0.309L0.422,-0.309C0.418,-0.353 0.407,-0.385 0.389,-0.407C0.361,-0.441 0.324,-0.458 0.28,-0.458C0.239,-0.458 0.205,-0.444 0.178,-0.417C0.15,-0.39 0.135,-0.354 0.132,-0.309Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.846695,-0.532078,0.532078,0.846695,-1020.65,1042.35)">
            <g transform="matrix(62.5,0,0,62.5,1298.53,2292.38)">
                <path d="M0.02,-0L0.02,-0.071L0.35,-0.45C0.312,-0.448 0.279,-0.447 0.25,-0.447L0.039,-0.447L0.039,-0.519L0.463,-0.519L0.463,-0.46L0.182,-0.131L0.128,-0.071C0.167,-0.074 0.204,-0.076 0.239,-0.076L0.479,-0.076L0.479,-0L0.02,-0Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.618326,-0.785921,0.785921,0.618326,-1231.58,1929.02)">
            <g transform="matrix(62.5,0,0,62.5,1370.28,2232.51)">
                <path d="M0.421,-0.167L0.512,-0.156C0.497,-0.103 0.471,-0.062 0.432,-0.032C0.393,-0.003 0.344,0.012 0.284,0.012C0.208,0.012 0.148,-0.012 0.103,-0.058C0.059,-0.105 0.037,-0.171 0.037,-0.255C0.037,-0.342 0.059,-0.41 0.104,-0.458C0.149,-0.506 0.207,-0.53 0.279,-0.53C0.348,-0.53 0.405,-0.507 0.449,-0.459C0.493,-0.412 0.515,-0.346 0.515,-0.26C0.515,-0.255 0.514,-0.247 0.514,-0.237L0.127,-0.237C0.131,-0.18 0.147,-0.136 0.176,-0.106C0.205,-0.076 0.241,-0.061 0.284,-0.061C0.316,-0.061 0.344,-0.069 0.367,-0.086C0.389,-0.103 0.408,-0.13 0.421,-0.167ZM0.132,-0.309L0.422,-0.309C0.418,-0.353 0.407,-0.385 0.389,-0.407C0.361,-0.441 0.324,-0.458 0.28,-0.458C0.239,-0.458 0.205,-0.444 0.178,-0.417C0.15,-0.39 0.135,-0.354 0.132,-0.309Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.438582,-0.898691,0.898691,0.438582,-1134.27,2488.32)">
            <g transform="matrix(62.5,0,0,62.5,1424.46,2152.01)">
                <path d="M0.02,-0L0.02,-0.071L0.35,-0.45C0.312,-0.448 0.279,-0.447 0.25,-0.447L0.039,-0.447L0.039,-0.519L0.463,-0.519L0.463,-0.46L0.182,-0.131L0.128,-0.071C0.167,-0.074 0.204,-0.076 0.239,-0.076L0.479,-0.076L0.479,-0L0.02,-0Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.25741,-0.966302,0.966302,0.25741,-911.413,2944.69)">
            <g transform="matrix(62.5,0,0,62.5,1460.2,2065.34)">
                <path d="M0.421,-0.167L0.512,-0.156C0.497,-0.103 0.471,-0.062 0.432,-0.032C0.393,-0.003 0.344,0.012 0.284,0.012C0.208,0.012 0.148,-0.012 0.103,-0.058C0.059,-0.105 0.037,-0.171 0.037,-0.255C0.037,-0.342 0.059,-0.41 0.104,-0.458C0.149,-0.506 0.207,-0.53 0.279,-0.53C0.348,-0.53 0.405,-0.507 0.449,-0.459C0.493,-0.412 0.515,-0.346 0.515,-0.26C0.515,-0.255 0.514,-0.247 0.514,-0.237L0.127,-0.237C0.131,-0.18 0.147,-0.136 0.176,-0.106C0.205,-0.076 0.241,-0.061 0.284,-0.061C0.316,-0.061 0.344,-0.069 0.367,-0.086C0.389,-0.103 0.408,-0.13 0.421,-0.167ZM0.132,-0.309L0.422,-0.309C0.418,-0.353 0.407,-0.385 0.389,-0.407C0.361,-0.441 0.324,-0.458 0.28,-0.458C0.239,-0.458 0.205,-0.444 0.178,-0.417C0.15,-0.39 0.135,-0.354 0.132,-0.309Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.500072,-0.865984,0.865984,0.500072,-963.832,2275.8)">
            <g transform="matrix(62.5,0,0,62.5,1489.17,1972.68)">
                <path d="M0.02,-0L0.02,-0.071L0.35,-0.45C0.312,-0.448 0.279,-0.447 0.25,-0.447L0.039,-0.447L0.039,-0.519L0.463,-0.519L0.463,-0.46L0.182,-0.131L0.128,-0.071C0.167,-0.074 0.204,-0.076 0.239,-0.076L0.479,-0.076L0.479,-0L0.02,-0Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.771246,-0.636537,0.636537,0.771246,-854.586,1417.53)">
            <g transform="matrix(62.5,0,0,62.5,1544.94,1897.76)">
                <path d="M0.421,-0.167L0.512,-0.156C0.497,-0.103 0.471,-0.062 0.432,-0.032C0.393,-0.003 0.344,0.012 0.284,0.012C0.208,0.012 0.148,-0.012 0.103,-0.058C0.059,-0.105 0.037,-0.171 0.037,-0.255C0.037,-0.342 0.059,-0.41 0.104,-0.458C0.149,-0.506 0.207,-0.53 0.279,-0.53C0.348,-0.53 0.405,-0.507 0.449,-0.459C0.493,-0.412 0.515,-0.346 0.515,-0.26C0.515,-0.255 0.514,-0.247 0.514,-0.237L0.127,-0.237C0.131,-0.18 0.147,-0.136 0.176,-0.106C0.205,-0.076 0.241,-0.061 0.284,-0.061C0.316,-0.061 0.344,-0.069 0.367,-0.086C0.389,-0.103 0.408,-0.13 0.421,-0.167ZM0.132,-0.309L0.422,-0.309C0.418,-0.353 0.407,-0.385 0.389,-0.407C0.361,-0.441 0.324,-0.458 0.28,-0.458C0.239,-0.458 0.205,-0.444 0.178,-0.417C0.15,-0.39 0.135,-0.354 0.132,-0.309Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.966699,-0.255916,0.255916,0.966699,-418.306,477.839)">
            <g transform="matrix(62.5,0,0,62.5,1626.93,1846.25)">
                <path d="M0.02,-0L0.02,-0.071L0.35,-0.45C0.312,-0.448 0.279,-0.447 0.25,-0.447L0.039,-0.447L0.039,-0.519L0.463,-0.519L0.463,-0.46L0.182,-0.131L0.128,-0.071C0.167,-0.074 0.204,-0.076 0.239,-0.076L0.479,-0.076L0.479,-0L0.02,-0Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.874528,0.484975,-0.484975,0.874528,1109.01,-602.908)">
            <g transform="matrix(62.5,0,0,62.5,1719.69,1841.82)">
                <path d="M0.421,-0.167L0.512,-0.156C0.497,-0.103 0.471,-0.062 0.432,-0.032C0.393,-0.003 0.344,0.012 0.284,0.012C0.208,0.012 0.148,-0.012 0.103,-0.058C0.059,-0.105 0.037,-0.171 0.037,-0.255C0.037,-0.342 0.059,-0.41 0.104,-0.458C0.149,-0.506 0.207,-0.53 0.279,-0.53C0.348,-0.53 0.405,-0.507 0.449,-0.459C0.493,-0.412 0.515,-0.346 0.515,-0.26C0.515,-0.255 0.514,-0.247 0.514,-0.237L0.127,-0.237C0.131,-0.18 0.147,-0.136 0.176,-0.106C0.205,-0.076 0.241,-0.061 0.284,-0.061C0.316,-0.061 0.344,-0.069 0.367,-0.086C0.389,-0.103 0.408,-0.13 0.421,-0.167ZM0.132,-0.309L0.422,-0.309C0.418,-0.353 0.407,-0.385 0.389,-0.407C0.361,-0.441 0.324,-0.458 0.28,-0.458C0.239,-0.458 0.205,-0.444 0.178,-0.417C0.15,-0.39 0.135,-0.354 0.132,-0.309Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.300453,0.953797,-0.953797,0.300453,3071.13,-367.019)">
            <g transform="matrix(62.5,0,0,62.5,1785.77,1910.16)">
                <path d="M0.02,-0L0.02,-0.071L0.35,-0.45C0.312,-0.448 0.279,-0.447 0.25,-0.447L0.039,-0.447L0.039,-0.519L0.463,-0.519L0.463,-0.46L0.182,-0.131L0.128,-0.071C0.167,-0.074 0.204,-0.076 0.239,-0.076L0.479,-0.076L0.479,-0L0.02,-0Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(-0.594198,0.804319,-0.804319,-0.594198,4458.97,1753.51)">
            <g transform="matrix(62.5,0,0,62.5,1787.14,2001.6)">
                <path d="M0.421,-0.167L0.512,-0.156C0.497,-0.103 0.471,-0.062 0.432,-0.032C0.393,-0.003 0.344,0.012 0.284,0.012C0.208,0.012 0.148,-0.012 0.103,-0.058C0.059,-0.105 0.037,-0.171 0.037,-0.255C0.037,-0.342 0.059,-0.41 0.104,-0.458C0.149,-0.506 0.207,-0.53 0.279,-0.53C0.348,-0.53 0.405,-0.507 0.449,-0.459C0.493,-0.412 0.515,-0.346 0.515,-0.26C0.515,-0.255 0.514,-0.247 0.514,-0.237L0.127,-0.237C0.131,-0.18 0.147,-0.136 0.176,-0.106C0.205,-0.076 0.241,-0.061 0.284,-0.061C0.316,-0.061 0.344,-0.069 0.367,-0.086C0.389,-0.103 0.408,-0.13 0.421,-0.167ZM0.132,-0.309L0.422,-0.309C0.418,-0.353 0.407,-0.385 0.389,-0.407C0.361,-0.441 0.324,-0.458 0.28,-0.458C0.239,-0.458 0.205,-0.444 0.178,-0.417C0.15,-0.39 0.135,-0.354 0.132,-0.309Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(-0.846023,0.533146,-0.533146,-0.846023,4272.4,2902.31)">
            <g transform="matrix(62.5,0,0,62.5,1717.09,2068.11)">
                <path d="M0.02,-0L0.02,-0.071L0.35,-0.45C0.312,-0.448 0.279,-0.447 0.25,-0.447L0.039,-0.447L0.039,-0.519L0.463,-0.519L0.463,-0.46L0.182,-0.131L0.128,-0.071C0.167,-0.074 0.204,-0.076 0.239,-0.076L0.479,-0.076L0.479,-0L0.02,-0Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(-0.860497,0.509456,-0.509456,-0.860497,4123.12,3103.46)">
            <g transform="matrix(62.5,0,0,62.5,1636.65,2116.24)">
                <path d="M0.421,-0.167L0.512,-0.156C0.497,-0.103 0.471,-0.062 0.432,-0.032C0.393,-0.003 0.344,0.012 0.284,0.012C0.208,0.012 0.148,-0.012 0.103,-0.058C0.059,-0.105 0.037,-0.171 0.037,-0.255C0.037,-0.342 0.059,-0.41 0.104,-0.458C0.149,-0.506 0.207,-0.53 0.279,-0.53C0.348,-0.53 0.405,-0.507 0.449,-0.459C0.493,-0.412 0.515,-0.346 0.515,-0.26C0.515,-0.255 0.514,-0.247 0.514,-0.237L0.127,-0.237C0.131,-0.18 0.147,-0.136 0.176,-0.106C0.205,-0.076 0.241,-0.061 0.284,-0.061C0.316,-0.061 0.344,-0.069 0.367,-0.086C0.389,-0.103 0.408,-0.13 0.421,-0.167ZM0.132,-0.309L0.422,-0.309C0.418,-0.353 0.407,-0.385 0.389,-0.407C0.361,-0.441 0.324,-0.458 0.28,-0.458C0.239,-0.458 0.205,-0.444 0.178,-0.417C0.15,-0.39 0.135,-0.354 0.132,-0.309Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(-0.790691,0.612216,-0.612216,-0.790691,4109.57,2929.99)">
            <g transform="matrix(62.5,0,0,62.5,1553.92,2167.5)">
                <path d="M0.02,-0L0.02,-0.071L0.35,-0.45C0.312,-0.448 0.279,-0.447 0.25,-0.447L0.039,-0.447L0.039,-0.519L0.463,-0.519L0.463,-0.46L0.182,-0.131L0.128,-0.071C0.167,-0.074 0.204,-0.076 0.239,-0.076L0.479,-0.076L0.479,-0L0.02,-0Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.453903,0.891051,-0.891051,0.453903,2816.62,-111.413)">
            <g transform="matrix(62.5,0,0,62.5,1499.2,2242.19)">
                <path d="M0.421,-0.167L0.512,-0.156C0.497,-0.103 0.471,-0.062 0.432,-0.032C0.393,-0.003 0.344,0.012 0.284,0.012C0.208,0.012 0.148,-0.012 0.103,-0.058C0.059,-0.105 0.037,-0.171 0.037,-0.255C0.037,-0.342 0.059,-0.41 0.104,-0.458C0.149,-0.506 0.207,-0.53 0.279,-0.53C0.348,-0.53 0.405,-0.507 0.449,-0.459C0.493,-0.412 0.515,-0.346 0.515,-0.26C0.515,-0.255 0.514,-0.247 0.514,-0.237L0.127,-0.237C0.131,-0.18 0.147,-0.136 0.176,-0.106C0.205,-0.076 0.241,-0.061 0.284,-0.061C0.316,-0.061 0.344,-0.069 0.367,-0.086C0.389,-0.103 0.408,-0.13 0.421,-0.167ZM0.132,-0.309L0.422,-0.309C0.418,-0.353 0.407,-0.385 0.389,-0.407C0.361,-0.441 0.324,-0.458 0.28,-0.458C0.239,-0.458 0.205,-0.444 0.178,-0.417C0.15,-0.39 0.135,-0.354 0.132,-0.309Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(1,7.31791e-06,-7.31791e-06,1,0.0168146,-0.0115141)">
            <g transform="matrix(62.5,0,0,62.5,1573.43,2297.73)">
                <path d="M0.02,-0L0.02,-0.071L0.35,-0.45C0.312,-0.448 0.279,-0.447 0.25,-0.447L0.039,-0.447L0.039,-0.519L0.463,-0.519L0.463,-0.46L0.182,-0.131L0.128,-0.071C0.167,-0.074 0.204,-0.076 0.239,-0.076L0.479,-0.076L0.479,-0L0.02,-0Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.449316,-0.893373,0.893373,0.449316,-1112.93,2732.75)">
            <g transform="matrix(62.5,0,0,62.5,1660.2,2269.12)">
                <path d="M0.421,-0.167L0.512,-0.156C0.497,-0.103 0.471,-0.062 0.432,-0.032C0.393,-0.003 0.344,0.012 0.284,0.012C0.208,0.012 0.148,-0.012 0.103,-0.058C0.059,-0.105 0.037,-0.171 0.037,-0.255C0.037,-0.342 0.059,-0.41 0.104,-0.458C0.149,-0.506 0.207,-0.53 0.279,-0.53C0.348,-0.53 0.405,-0.507 0.449,-0.459C0.493,-0.412 0.515,-0.346 0.515,-0.26C0.515,-0.255 0.514,-0.247 0.514,-0.237L0.127,-0.237C0.131,-0.18 0.147,-0.136 0.176,-0.106C0.205,-0.076 0.241,-0.061 0.284,-0.061C0.316,-0.061 0.344,-0.069 0.367,-0.086C0.389,-0.103 0.408,-0.13 0.421,-0.167ZM0.132,-0.309L0.422,-0.309C0.418,-0.353 0.407,-0.385 0.389,-0.407C0.361,-0.441 0.324,-0.458 0.28,-0.458C0.239,-0.458 0.205,-0.444 0.178,-0.417C0.15,-0.39 0.135,-0.354 0.132,-0.309Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.832099,-0.554627,0.554627,0.832099,-924.112,1312.22)">
            <g transform="matrix(62.5,0,0,62.5,1705.27,2182.42)">
                <path d="M0.02,-0L0.02,-0.071L0.35,-0.45C0.312,-0.448 0.279,-0.447 0.25,-0.447L0.039,-0.447L0.039,-0.519L0.463,-0.519L0.463,-0.46L0.182,-0.131L0.128,-0.071C0.167,-0.074 0.204,-0.076 0.239,-0.076L0.479,-0.076L0.479,-0L0.02,-0Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(0.602274,0.79829,-0.79829,0.602274,2442.01,-575.71)">
            <g transform="matrix(62.5,0,0,62.5,1798.77,2162.86)">
                <path d="M0.421,-0.167L0.512,-0.156C0.497,-0.103 0.471,-0.062 0.432,-0.032C0.393,-0.003 0.344,0.012 0.284,0.012C0.208,0.012 0.148,-0.012 0.103,-0.058C0.059,-0.105 0.037,-0.171 0.037,-0.255C0.037,-0.342 0.059,-0.41 0.104,-0.458C0.149,-0.506 0.207,-0.53 0.279,-0.53C0.348,-0.53 0.405,-0.507 0.449,-0.459C0.493,-0.412 0.515,-0.346 0.515,-0.26C0.515,-0.255 0.514,-0.247 0.514,-0.237L0.127,-0.237C0.131,-0.18 0.147,-0.136 0.176,-0.106C0.205,-0.076 0.241,-0.061 0.284,-0.061C0.316,-0.061 0.344,-0.069 0.367,-0.086C0.389,-0.103 0.408,-0.13 0.421,-0.167ZM0.132,-0.309L0.422,-0.309C0.418,-0.353 0.407,-0.385 0.389,-0.407C0.361,-0.441 0.324,-0.458 0.28,-0.458C0.239,-0.458 0.205,-0.444 0.178,-0.417C0.15,-0.39 0.135,-0.354 0.132,-0.309Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
        <g transform="matrix(-0.144653,0.989482,-0.989482,-0.144653,4311.68,782.461)">
            <g transform="matrix(62.5,0,0,62.5,1817.64,2254.82)">
                <path d="M0.02,-0L0.02,-0.071L0.35,-0.45C0.312,-0.448 0.279,-0.447 0.25,-0.447L0.039,-0.447L0.039,-0.519L0.463,-0.519L0.463,-0.46L0.182,-0.131L0.128,-0.071C0.167,-0.074 0.204,-0.076 0.239,-0.076L0.479,-0.076L0.479,-0L0.02,-0Z" style="fill-rule:nonzero;"/>
            </g>
        </g>
    </g>
</svg>


`;

    /* src/Overview.svelte generated by Svelte v3.38.2 */

    const { Object: Object_1, console: console_1, window: window_1 } = globals;
    const file = "src/Overview.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[48] = list[i];
    	child_ctx[49] = list;
    	child_ctx[50] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[51] = list[i][0];
    	child_ctx[52] = list[i][1];
    	child_ctx[53] = list;
    	child_ctx[54] = i;
    	return child_ctx;
    }

    // (369:3) {:else}
    function create_else_block_2(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "N/A";
    			attr_dev(div, "class", "plr1 mb1 fade");
    			add_location(div, file, 369, 4, 9091);
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
    		source: "(369:3) {:else}",
    		ctx
    	});

    	return block;
    }

    // (329:3) {#if endpoint}
    function create_if_block_2(ctx) {
    	let form;
    	let show_if = Object.keys(/*endpoint*/ ctx[10].schema).length == 0;
    	let t;
    	let if_block = show_if && create_if_block_5(ctx);
    	let each_value_1 = Object.entries(/*endpoint*/ ctx[10].schema);
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const block = {
    		c: function create() {
    			form = element("form");
    			if (if_block) if_block.c();
    			t = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			attr_dev(form, "class", "flex column cmb1 p1");
    			toggle_class(form, "hidden", !/*inited*/ ctx[3]);
    			add_location(form, file, 329, 4, 7939);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);
    			if (if_block) if_block.m(form, null);
    			append_dev(form, t);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(form, null);
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*endpoint*/ 1024) show_if = Object.keys(/*endpoint*/ ctx[10].schema).length == 0;

    			if (show_if) {
    				if (if_block) ; else {
    					if_block = create_if_block_5(ctx);
    					if_block.c();
    					if_block.m(form, t);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty[0] & /*endpoint, values, hash*/ 1027) {
    				each_value_1 = Object.entries(/*endpoint*/ ctx[10].schema);
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(form, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}

    			if (dirty[0] & /*inited*/ 8) {
    				toggle_class(form, "hidden", !/*inited*/ ctx[3]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			if (if_block) if_block.d();
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(329:3) {#if endpoint}",
    		ctx
    	});

    	return block;
    }

    // (331:5) {#if Object.keys(endpoint.schema).length == 0 }
    function create_if_block_5(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "N/A";
    			attr_dev(div, "class", "fade");
    			add_location(div, file, 331, 6, 8057);
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
    		source: "(331:5) {#if Object.keys(endpoint.schema).length == 0 }",
    		ctx
    	});

    	return block;
    }

    // (359:6) {:else}
    function create_else_block_1(ctx) {
    	let input;
    	let input_name_value;
    	let input_required_value;
    	let input_placeholder_value;
    	let mounted;
    	let dispose;

    	function input_input_handler() {
    		/*input_input_handler*/ ctx[38].call(input, /*key*/ ctx[51]);
    	}

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "name", input_name_value = /*key*/ ctx[51]);
    			attr_dev(input, "class", "flex grow p0-6");
    			input.required = input_required_value = /*value*/ ctx[52].required;
    			attr_dev(input, "placeholder", input_placeholder_value = /*key*/ ctx[51]);
    			add_location(input, file, 359, 7, 8875);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*values*/ ctx[1][/*hash*/ ctx[0]][/*key*/ ctx[51]]);

    			if (!mounted) {
    				dispose = listen_dev(input, "input", input_input_handler);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*endpoint*/ 1024 && input_name_value !== (input_name_value = /*key*/ ctx[51])) {
    				attr_dev(input, "name", input_name_value);
    			}

    			if (dirty[0] & /*endpoint*/ 1024 && input_required_value !== (input_required_value = /*value*/ ctx[52].required)) {
    				prop_dev(input, "required", input_required_value);
    			}

    			if (dirty[0] & /*endpoint*/ 1024 && input_placeholder_value !== (input_placeholder_value = /*key*/ ctx[51])) {
    				attr_dev(input, "placeholder", input_placeholder_value);
    			}

    			if (dirty[0] & /*values, hash, endpoint*/ 1027 && input.value !== /*values*/ ctx[1][/*hash*/ ctx[0]][/*key*/ ctx[51]]) {
    				set_input_value(input, /*values*/ ctx[1][/*hash*/ ctx[0]][/*key*/ ctx[51]]);
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
    		source: "(359:6) {:else}",
    		ctx
    	});

    	return block;
    }

    // (351:65) 
    function create_if_block_4(ctx) {
    	let textarea;
    	let textarea_name_value;
    	let textarea_required_value;
    	let textarea_placeholder_value;
    	let mounted;
    	let dispose;

    	function textarea_input_handler() {
    		/*textarea_input_handler*/ ctx[37].call(textarea, /*key*/ ctx[51]);
    	}

    	const block = {
    		c: function create() {
    			textarea = element("textarea");
    			attr_dev(textarea, "name", textarea_name_value = /*key*/ ctx[51]);
    			attr_dev(textarea, "class", "monospace flex grow p0-6");
    			attr_dev(textarea, "rows", "6");
    			textarea.required = textarea_required_value = /*value*/ ctx[52].required;
    			attr_dev(textarea, "placeholder", textarea_placeholder_value = /*key*/ ctx[51]);
    			add_location(textarea, file, 351, 7, 8659);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, textarea, anchor);
    			set_input_value(textarea, /*values*/ ctx[1][/*hash*/ ctx[0]][/*key*/ ctx[51]]);

    			if (!mounted) {
    				dispose = listen_dev(textarea, "input", textarea_input_handler);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*endpoint*/ 1024 && textarea_name_value !== (textarea_name_value = /*key*/ ctx[51])) {
    				attr_dev(textarea, "name", textarea_name_value);
    			}

    			if (dirty[0] & /*endpoint*/ 1024 && textarea_required_value !== (textarea_required_value = /*value*/ ctx[52].required)) {
    				prop_dev(textarea, "required", textarea_required_value);
    			}

    			if (dirty[0] & /*endpoint*/ 1024 && textarea_placeholder_value !== (textarea_placeholder_value = /*key*/ ctx[51])) {
    				attr_dev(textarea, "placeholder", textarea_placeholder_value);
    			}

    			if (dirty[0] & /*values, hash, endpoint*/ 1027) {
    				set_input_value(textarea, /*values*/ ctx[1][/*hash*/ ctx[0]][/*key*/ ctx[51]]);
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
    		source: "(351:65) ",
    		ctx
    	});

    	return block;
    }

    // (341:6) {#if value.type == 'boolean'}
    function create_if_block_3(ctx) {
    	let label;
    	let input;
    	let input_name_value;
    	let input_placeholder_value;
    	let input_required_value;
    	let t0;
    	let span;
    	let t1;
    	let mounted;
    	let dispose;

    	function input_change_handler() {
    		/*input_change_handler*/ ctx[36].call(input, /*key*/ ctx[51]);
    	}

    	const block = {
    		c: function create() {
    			label = element("label");
    			input = element("input");
    			t0 = space();
    			span = element("span");
    			t1 = space();
    			attr_dev(input, "name", input_name_value = /*key*/ ctx[51]);
    			attr_dev(input, "type", "checkbox");
    			attr_dev(input, "placeholder", input_placeholder_value = /*key*/ ctx[51]);
    			input.required = input_required_value = /*value*/ ctx[52].required;
    			add_location(input, file, 342, 8, 8390);
    			add_location(span, file, 348, 8, 8561);
    			attr_dev(label, "class", "checkbox");
    			add_location(label, file, 341, 7, 8357);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, label, anchor);
    			append_dev(label, input);
    			input.checked = /*values*/ ctx[1][/*hash*/ ctx[0]][/*key*/ ctx[51]];
    			append_dev(label, t0);
    			append_dev(label, span);
    			append_dev(label, t1);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", input_change_handler);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*endpoint*/ 1024 && input_name_value !== (input_name_value = /*key*/ ctx[51])) {
    				attr_dev(input, "name", input_name_value);
    			}

    			if (dirty[0] & /*endpoint*/ 1024 && input_placeholder_value !== (input_placeholder_value = /*key*/ ctx[51])) {
    				attr_dev(input, "placeholder", input_placeholder_value);
    			}

    			if (dirty[0] & /*endpoint*/ 1024 && input_required_value !== (input_required_value = /*value*/ ctx[52].required)) {
    				prop_dev(input, "required", input_required_value);
    			}

    			if (dirty[0] & /*values, hash, endpoint*/ 1027) {
    				input.checked = /*values*/ ctx[1][/*hash*/ ctx[0]][/*key*/ ctx[51]];
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(label);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(341:6) {#if value.type == 'boolean'}",
    		ctx
    	});

    	return block;
    }

    // (336:5) {#each Object.entries(endpoint.schema) as [key, value]}
    function create_each_block_1(ctx) {
    	let div;
    	let t0_value = /*key*/ ctx[51] + "";
    	let t0;
    	let t1;
    	let t2_value = (/*value*/ ctx[52].required ? "*" : "") + "";
    	let t2;
    	let t3;
    	let span;
    	let t4_value = /*value*/ ctx[52].type + "";
    	let t4;
    	let t5;
    	let if_block_anchor;

    	function select_block_type_1(ctx, dirty) {
    		if (/*value*/ ctx[52].type == "boolean") return create_if_block_3;
    		if (/*value*/ ctx[52].type == "object" || /*value*/ ctx[52].type == "array") return create_if_block_4;
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
    			add_location(span, file, 338, 7, 8245);
    			attr_dev(div, "class", "bold");
    			add_location(div, file, 336, 6, 8178);
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
    			if (dirty[0] & /*endpoint*/ 1024 && t0_value !== (t0_value = /*key*/ ctx[51] + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*endpoint*/ 1024 && t2_value !== (t2_value = (/*value*/ ctx[52].required ? "*" : "") + "")) set_data_dev(t2, t2_value);
    			if (dirty[0] & /*endpoint*/ 1024 && t4_value !== (t4_value = /*value*/ ctx[52].type + "")) set_data_dev(t4, t4_value);

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
    		source: "(336:5) {#each Object.entries(endpoint.schema) as [key, value]}",
    		ctx
    	});

    	return block;
    }

    // (400:5) {:else}
    function create_else_block(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "N/A";
    			attr_dev(div, "class", "fade");
    			add_location(div, file, 400, 6, 9828);
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
    		id: create_else_block.name,
    		type: "else",
    		source: "(400:5) {:else}",
    		ctx
    	});

    	return block;
    }

    // (378:5) {#if endpoint}
    function create_if_block(ctx) {
    	let p;
    	let t0_value = /*endpoint*/ ctx[10].description + "";
    	let t0;
    	let t1;
    	let t2;
    	let input;
    	let t3;
    	let button;
    	let t4;
    	let mounted;
    	let dispose;
    	let each_value = /*components*/ ctx[2][/*hash*/ ctx[0]];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text(t0_value);
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			input = element("input");
    			t3 = space();
    			button = element("button");
    			t4 = text("send");
    			add_location(p, file, 378, 6, 9304);
    			attr_dev(input, "type", "text");
    			input.disabled = true;
    			input.value = /*path*/ ctx[11];
    			add_location(input, file, 392, 6, 9639);
    			attr_dev(button, "class", "filled");
    			button.disabled = /*waiting*/ ctx[4];
    			add_location(button, file, 393, 6, 9696);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			insert_dev(target, t1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, t2, anchor);
    			insert_dev(target, input, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, button, anchor);
    			append_dev(button, t4);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*submit*/ ctx[19], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*endpoint*/ 1024 && t0_value !== (t0_value = /*endpoint*/ ctx[10].description + "")) set_data_dev(t0, t0_value);

    			if (dirty[0] & /*components, hash*/ 5) {
    				each_value = /*components*/ ctx[2][/*hash*/ ctx[0]];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(t2.parentNode, t2);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty[0] & /*path*/ 2048 && input.value !== /*path*/ ctx[11]) {
    				prop_dev(input, "value", /*path*/ ctx[11]);
    			}

    			if (dirty[0] & /*waiting*/ 16) {
    				prop_dev(button, "disabled", /*waiting*/ ctx[4]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t1);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(input);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(378:5) {#if endpoint}",
    		ctx
    	});

    	return block;
    }

    // (382:7) {#if piece.type > 0}
    function create_if_block_1(ctx) {
    	let div;
    	let t0_value = /*piece*/ ctx[48].val + "";
    	let t0;
    	let t1;
    	let input;
    	let input_name_value;
    	let input_placeholder_value;
    	let mounted;
    	let dispose;

    	function input_input_handler_1() {
    		/*input_input_handler_1*/ ctx[39].call(input, /*each_value*/ ctx[49], /*piece_index*/ ctx[50]);
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			input = element("input");
    			attr_dev(div, "class", "bold");
    			add_location(div, file, 382, 8, 9411);
    			attr_dev(input, "name", input_name_value = /*piece*/ ctx[48].val);
    			attr_dev(input, "type", "text");
    			attr_dev(input, "placeholder", input_placeholder_value = /*piece*/ ctx[48].val);
    			add_location(input, file, 385, 8, 9474);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t0);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*piece*/ ctx[48].value);

    			if (!mounted) {
    				dispose = listen_dev(input, "input", input_input_handler_1);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*components, hash*/ 5 && t0_value !== (t0_value = /*piece*/ ctx[48].val + "")) set_data_dev(t0, t0_value);

    			if (dirty[0] & /*components, hash*/ 5 && input_name_value !== (input_name_value = /*piece*/ ctx[48].val)) {
    				attr_dev(input, "name", input_name_value);
    			}

    			if (dirty[0] & /*components, hash*/ 5 && input_placeholder_value !== (input_placeholder_value = /*piece*/ ctx[48].val)) {
    				attr_dev(input, "placeholder", input_placeholder_value);
    			}

    			if (dirty[0] & /*components, hash*/ 5 && input.value !== /*piece*/ ctx[48].value) {
    				set_input_value(input, /*piece*/ ctx[48].value);
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
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(382:7) {#if piece.type > 0}",
    		ctx
    	});

    	return block;
    }

    // (381:6) {#each components[hash] as piece}
    function create_each_block(ctx) {
    	let if_block_anchor;
    	let if_block = /*piece*/ ctx[48].type > 0 && create_if_block_1(ctx);

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
    			if (/*piece*/ ctx[48].type > 0) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
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
    		source: "(381:6) {#each components[hash] as piece}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let div18;
    	let div7;
    	let div0;
    	let h40;
    	let span0;
    	let t1;
    	let div1;
    	let table0;
    	let t2;
    	let div6;
    	let h41;
    	let span1;
    	let t4;
    	let div4;
    	let div2;
    	let span2;
    	let t6;
    	let span3;
    	let t7_value = (/*who*/ ctx[5].username || "") + "";
    	let t7;
    	let t8;
    	let div3;
    	let t9;
    	let t10;
    	let form;
    	let input0;
    	let t11;
    	let input1;
    	let t12;
    	let button0;
    	let t14;
    	let div5;
    	let button1;
    	let t16;
    	let div10;
    	let div8;
    	let h42;
    	let span4;
    	let t18;
    	let t19;
    	let div9;
    	let h43;
    	let span5;
    	let t21;
    	let t22;
    	let div17;
    	let div13;
    	let div11;
    	let h44;
    	let span6;
    	let t24;
    	let button2;
    	let t26;
    	let div12;
    	let table1;
    	let t27;
    	let div16;
    	let div14;
    	let h45;
    	let span7;
    	let t29;
    	let button3;
    	let t31;
    	let div15;
    	let pre;

    	let raw_value = (/*waiting*/ ctx[4]
    	? `<span class="fade">waiting...</span>`
    	: /*str*/ ctx[12] == "\"\"" ? "" : /*str*/ ctx[12]) + "";

    	let current;
    	let mounted;
    	let dispose;

    	table0 = new Table({
    			props: {
    				init: /*init*/ ctx[8],
    				classes: /*classes*/ ctx[9],
    				features: /*features*/ ctx[16],
    				callbacks: /*callbacks*/ ctx[17],
    				dimensions: /*dimensions*/ ctx[15]
    			},
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (/*endpoint*/ ctx[10]) return create_if_block_2;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block0 = current_block_type(ctx);

    	function select_block_type_2(ctx, dirty) {
    		if (/*endpoint*/ ctx[10]) return create_if_block;
    		return create_else_block;
    	}

    	let current_block_type_1 = select_block_type_2(ctx);
    	let if_block1 = current_block_type_1(ctx);

    	table1 = new Table({
    			props: {
    				init: /*historyInit*/ ctx[13],
    				classes: /*historyClasses*/ ctx[14],
    				dimensions: /*historyDimensions*/ ctx[22],
    				callbacks: /*historyCallbacks*/ ctx[24],
    				features: /*historyFeatures*/ ctx[23]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			main = element("main");
    			div18 = element("div");
    			div7 = element("div");
    			div0 = element("div");
    			h40 = element("h4");
    			span0 = element("span");
    			span0.textContent = "Application Programming Interface";
    			t1 = space();
    			div1 = element("div");
    			create_component(table0.$$.fragment);
    			t2 = space();
    			div6 = element("div");
    			h41 = element("h4");
    			span1 = element("span");
    			span1.textContent = "Auth";
    			t4 = space();
    			div4 = element("div");
    			div2 = element("div");
    			span2 = element("span");
    			span2.textContent = "Viewing as";
    			t6 = space();
    			span3 = element("span");
    			t7 = text(t7_value);
    			t8 = space();
    			div3 = element("div");
    			t9 = text(/*loginError*/ ctx[7]);
    			t10 = space();
    			form = element("form");
    			input0 = element("input");
    			t11 = space();
    			input1 = element("input");
    			t12 = space();
    			button0 = element("button");
    			button0.textContent = "login";
    			t14 = space();
    			div5 = element("div");
    			button1 = element("button");
    			button1.textContent = "logout";
    			t16 = space();
    			div10 = element("div");
    			div8 = element("div");
    			h42 = element("h4");
    			span4 = element("span");
    			span4.textContent = "Arguments";
    			t18 = space();
    			if_block0.c();
    			t19 = space();
    			div9 = element("div");
    			h43 = element("h4");
    			span5 = element("span");
    			span5.textContent = "Endpoint";
    			t21 = space();
    			if_block1.c();
    			t22 = space();
    			div17 = element("div");
    			div13 = element("div");
    			div11 = element("div");
    			h44 = element("h4");
    			span6 = element("span");
    			span6.textContent = "Response";
    			t24 = space();
    			button2 = element("button");
    			button2.textContent = "clear";
    			t26 = space();
    			div12 = element("div");
    			create_component(table1.$$.fragment);
    			t27 = space();
    			div16 = element("div");
    			div14 = element("div");
    			h45 = element("h4");
    			span7 = element("span");
    			span7.textContent = "Data";
    			t29 = space();
    			button3 = element("button");
    			button3.textContent = "copy";
    			t31 = space();
    			div15 = element("div");
    			pre = element("pre");
    			attr_dev(span0, "class", "bb2-solid block");
    			add_location(span0, file, 282, 5, 6402);
    			attr_dev(h40, "class", "bold flex");
    			add_location(h40, file, 281, 4, 6374);
    			attr_dev(div0, "class", "p1");
    			add_location(div0, file, 280, 3, 6353);
    			attr_dev(div1, "class", "overflow-auto h100pc");
    			toggle_class(div1, "hidden", !/*inited*/ ctx[3]);
    			add_location(div1, file, 285, 3, 6496);
    			attr_dev(span1, "class", "bb2-solid block");
    			add_location(span1, file, 291, 5, 6711);
    			attr_dev(h41, "class", "flex bold");
    			add_location(h41, file, 290, 4, 6683);
    			add_location(span2, file, 295, 6, 6864);
    			attr_dev(span3, "class", "bb1-solid inline-block bold");
    			add_location(span3, file, 296, 6, 6895);
    			attr_dev(div2, "class", "h2em");
    			add_location(div2, file, 294, 5, 6839);
    			add_location(div3, file, 298, 5, 6982);
    			attr_dev(div4, "class", "flex row-space-between-center");
    			toggle_class(div4, "hidden", !/*inited*/ ctx[3]);
    			add_location(div4, file, 293, 4, 6767);
    			attr_dev(input0, "name", "username");
    			attr_dev(input0, "class", "grow mr1");
    			attr_dev(input0, "type", "text");
    			attr_dev(input0, "placeholder", "username");
    			add_location(input0, file, 308, 5, 7178);
    			attr_dev(input1, "name", "password");
    			attr_dev(input1, "class", "grow mr1");
    			attr_dev(input1, "type", "password");
    			attr_dev(input1, "placeholder", "password");
    			add_location(input1, file, 309, 5, 7289);
    			attr_dev(button0, "class", "filled ");
    			add_location(button0, file, 310, 5, 7404);
    			attr_dev(form, "method", "post");
    			attr_dev(form, "action", "/api/login");
    			attr_dev(form, "class", "flex row");
    			toggle_class(form, "hidden", !/*inited*/ ctx[3]);
    			toggle_class(form, "none", /*who*/ ctx[5].loggedin);
    			add_location(form, file, 302, 4, 7035);
    			attr_dev(button1, "class", "filled");
    			add_location(button1, file, 315, 5, 7589);
    			attr_dev(div5, "class", "grow basis0em h100pc flex row-flex-start-stretch cmr1");
    			toggle_class(div5, "none", !/*who*/ ctx[5].loggedin);
    			add_location(div5, file, 312, 4, 7477);
    			attr_dev(div6, "class", "p1 bt1-solid flex column cmb1");
    			add_location(div6, file, 289, 3, 6635);
    			attr_dev(div7, "class", "flex column basis10pc br1-solid grow overflow-hidden h100vh");
    			add_location(div7, file, 279, 2, 6276);
    			attr_dev(span4, "class", "bb2-solid block");
    			add_location(span4, file, 325, 5, 7850);
    			attr_dev(h42, "class", "flex bold");
    			add_location(h42, file, 324, 4, 7822);
    			attr_dev(div8, "class", "p1");
    			add_location(div8, file, 323, 3, 7801);
    			attr_dev(span5, "class", "bb2-solid block");
    			add_location(span5, file, 375, 6, 9221);
    			attr_dev(h43, "class", "flex bold");
    			add_location(h43, file, 374, 5, 9192);
    			attr_dev(div9, "class", "flex column cmb1 p1 bt1-solid");
    			add_location(div9, file, 373, 4, 9143);
    			attr_dev(div10, "class", "flex column no-basis br1-solid grow overflow-auto");
    			add_location(div10, file, 321, 2, 7733);
    			attr_dev(span6, "class", "bb2-solid block");
    			add_location(span6, file, 411, 6, 10091);
    			attr_dev(h44, "class", "flex bold");
    			add_location(h44, file, 410, 5, 10062);
    			add_location(button2, file, 413, 5, 10153);
    			attr_dev(div11, "class", "p1 flex row-space-between-center");
    			add_location(div11, file, 409, 4, 10010);
    			attr_dev(div12, "class", "overflow-auto h100pc");
    			toggle_class(div12, "hidden", !/*inited*/ ctx[3]);
    			add_location(div12, file, 415, 4, 10208);
    			attr_dev(div13, "class", "overflow-hidden minh50vh maxh50vh h50vh flex column");
    			add_location(div13, file, 408, 3, 9940);
    			attr_dev(span7, "class", "bb2-solid block");
    			add_location(span7, file, 427, 6, 10587);
    			add_location(h45, file, 426, 5, 10576);
    			add_location(button3, file, 429, 5, 10645);
    			attr_dev(div14, "class", "flex row-space-between-center");
    			add_location(div14, file, 425, 4, 10527);
    			attr_dev(pre, "class", "mtb1 monospace w100pc");
    			set_style(pre, "word-wrap", "break-word");
    			set_style(pre, "white-space", "pre-wrap");
    			add_location(pre, file, 432, 5, 10769);
    			attr_dev(div15, "class", "overflow-auto h100pc w100pc");
    			toggle_class(div15, "hidden", !/*inited*/ ctx[3]);
    			add_location(div15, file, 431, 4, 10698);
    			attr_dev(div16, "class", "flex column p1 bt1-solid overflow-hidden");
    			add_location(div16, file, 424, 3, 10468);
    			attr_dev(div17, "class", "flex flex-column grow no-basis");
    			add_location(div17, file, 404, 2, 9889);
    			attr_dev(div18, "class", "flex grow h100pc");
    			add_location(div18, file, 278, 1, 6243);
    			attr_dev(main, "class", "flex column-stretch-stretch h100vh overflow-hidden");
    			add_location(main, file, 277, 0, 6176);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div18);
    			append_dev(div18, div7);
    			append_dev(div7, div0);
    			append_dev(div0, h40);
    			append_dev(h40, span0);
    			append_dev(div7, t1);
    			append_dev(div7, div1);
    			mount_component(table0, div1, null);
    			append_dev(div7, t2);
    			append_dev(div7, div6);
    			append_dev(div6, h41);
    			append_dev(h41, span1);
    			append_dev(div6, t4);
    			append_dev(div6, div4);
    			append_dev(div4, div2);
    			append_dev(div2, span2);
    			append_dev(div2, t6);
    			append_dev(div2, span3);
    			append_dev(span3, t7);
    			append_dev(div4, t8);
    			append_dev(div4, div3);
    			append_dev(div3, t9);
    			append_dev(div6, t10);
    			append_dev(div6, form);
    			append_dev(form, input0);
    			set_input_value(input0, /*creds*/ ctx[6].username);
    			append_dev(form, t11);
    			append_dev(form, input1);
    			set_input_value(input1, /*creds*/ ctx[6].password);
    			append_dev(form, t12);
    			append_dev(form, button0);
    			append_dev(div6, t14);
    			append_dev(div6, div5);
    			append_dev(div5, button1);
    			append_dev(div18, t16);
    			append_dev(div18, div10);
    			append_dev(div10, div8);
    			append_dev(div8, h42);
    			append_dev(h42, span4);
    			append_dev(div10, t18);
    			if_block0.m(div10, null);
    			append_dev(div10, t19);
    			append_dev(div10, div9);
    			append_dev(div9, h43);
    			append_dev(h43, span5);
    			append_dev(div9, t21);
    			if_block1.m(div9, null);
    			append_dev(div18, t22);
    			append_dev(div18, div17);
    			append_dev(div17, div13);
    			append_dev(div13, div11);
    			append_dev(div11, h44);
    			append_dev(h44, span6);
    			append_dev(div11, t24);
    			append_dev(div11, button2);
    			append_dev(div13, t26);
    			append_dev(div13, div12);
    			mount_component(table1, div12, null);
    			append_dev(div17, t27);
    			append_dev(div17, div16);
    			append_dev(div16, div14);
    			append_dev(div14, h45);
    			append_dev(h45, span7);
    			append_dev(div14, t29);
    			append_dev(div14, button3);
    			append_dev(div16, t31);
    			append_dev(div16, div15);
    			append_dev(div15, pre);
    			pre.innerHTML = raw_value;
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(window_1, "hashchange", /*onHashChange*/ ctx[18], false, false, false),
    					listen_dev(input0, "input", /*input0_input_handler*/ ctx[34]),
    					listen_dev(input1, "input", /*input1_input_handler*/ ctx[35]),
    					listen_dev(button0, "click", /*login*/ ctx[20], false, false, false),
    					listen_dev(button1, "click", /*logout*/ ctx[21], false, false, false),
    					listen_dev(button2, "click", /*clear*/ ctx[25], false, false, false),
    					listen_dev(button3, "click", /*copy*/ ctx[26], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			const table0_changes = {};
    			if (dirty[0] & /*init*/ 256) table0_changes.init = /*init*/ ctx[8];
    			if (dirty[0] & /*classes*/ 512) table0_changes.classes = /*classes*/ ctx[9];
    			table0.$set(table0_changes);

    			if (dirty[0] & /*inited*/ 8) {
    				toggle_class(div1, "hidden", !/*inited*/ ctx[3]);
    			}

    			if ((!current || dirty[0] & /*who*/ 32) && t7_value !== (t7_value = (/*who*/ ctx[5].username || "") + "")) set_data_dev(t7, t7_value);
    			if (!current || dirty[0] & /*loginError*/ 128) set_data_dev(t9, /*loginError*/ ctx[7]);

    			if (dirty[0] & /*inited*/ 8) {
    				toggle_class(div4, "hidden", !/*inited*/ ctx[3]);
    			}

    			if (dirty[0] & /*creds*/ 64 && input0.value !== /*creds*/ ctx[6].username) {
    				set_input_value(input0, /*creds*/ ctx[6].username);
    			}

    			if (dirty[0] & /*creds*/ 64 && input1.value !== /*creds*/ ctx[6].password) {
    				set_input_value(input1, /*creds*/ ctx[6].password);
    			}

    			if (dirty[0] & /*inited*/ 8) {
    				toggle_class(form, "hidden", !/*inited*/ ctx[3]);
    			}

    			if (dirty[0] & /*who*/ 32) {
    				toggle_class(form, "none", /*who*/ ctx[5].loggedin);
    			}

    			if (dirty[0] & /*who*/ 32) {
    				toggle_class(div5, "none", !/*who*/ ctx[5].loggedin);
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block0) {
    				if_block0.p(ctx, dirty);
    			} else {
    				if_block0.d(1);
    				if_block0 = current_block_type(ctx);

    				if (if_block0) {
    					if_block0.c();
    					if_block0.m(div10, t19);
    				}
    			}

    			if (current_block_type_1 === (current_block_type_1 = select_block_type_2(ctx)) && if_block1) {
    				if_block1.p(ctx, dirty);
    			} else {
    				if_block1.d(1);
    				if_block1 = current_block_type_1(ctx);

    				if (if_block1) {
    					if_block1.c();
    					if_block1.m(div9, null);
    				}
    			}

    			const table1_changes = {};
    			if (dirty[0] & /*historyInit*/ 8192) table1_changes.init = /*historyInit*/ ctx[13];
    			if (dirty[0] & /*historyClasses*/ 16384) table1_changes.classes = /*historyClasses*/ ctx[14];
    			table1.$set(table1_changes);

    			if (dirty[0] & /*inited*/ 8) {
    				toggle_class(div12, "hidden", !/*inited*/ ctx[3]);
    			}

    			if ((!current || dirty[0] & /*waiting, str*/ 4112) && raw_value !== (raw_value = (/*waiting*/ ctx[4]
    			? `<span class="fade">waiting...</span>`
    			: /*str*/ ctx[12] == "\"\"" ? "" : /*str*/ ctx[12]) + "")) pre.innerHTML = raw_value;
    			if (dirty[0] & /*inited*/ 8) {
    				toggle_class(div15, "hidden", !/*inited*/ ctx[3]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(table0.$$.fragment, local);
    			transition_in(table1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(table0.$$.fragment, local);
    			transition_out(table1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_component(table0);
    			if_block0.d();
    			if_block1.d();
    			destroy_component(table1);
    			mounted = false;
    			run_all(dispose);
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
    	let classes;
    	let endpoint;
    	let args;
    	let regexed;
    	let path;
    	let storage;
    	let str;
    	let historyInit;
    	let historyClasses;
    	let saveable;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Overview", slots, []);
    	let endpoints = [];
    	let inited = false;

    	let dimensions = {
    		padding: 13,
    		widths: [280, 120, 80, 110],
    		minwidth: 800
    	};

    	let features = { sortable: { key: "category" } };

    	let callbacks = {
    		render: {
    			cell: o => {
    				const URL = o.key == "url";
    				const PERM = o.key == "permissions";

    				const v = PERM
    				? `<span class="${o.value ? "cross" : ""} w1em h1em block" />`
    				: o.value;

    				return `
					<a 
						class="unclickable fill"
						${URL ? "target=\"_blank\"" : ""}
						href="${URL ? o.value : "#" + o.item.url}">
					</a>
					<span class="
						${URL ? "bb1-solid" : ""}
					">${v}</span>
				`;
    			}
    		}
    	};

    	function onHashChange() {
    		$$invalidate(0, hash = window.location.hash.substring(1));
    		if (!values[hash]) $$invalidate(1, values[hash] = {}, values);
    		for (let i = 0; i < endpoints.length; i++) $$invalidate(27, endpoints[i].selected = endpoints[i]?.item?.url == hash, endpoints);
    		status = null;
    		$$invalidate(4, waiting = false);
    		$$invalidate(29, data = "");
    		if (!components[hash]) $$invalidate(2, components[hash] = parse(hash), components);
    		whoami();
    	}

    	async function getPermissions() {
    		for (let i = 0; i < endpoints.length; i++) {
    			let e = endpoints[i];
    			const res = await fetcheriser[e.type.toLowerCase()](e.url, { ezapi_permissions: true });
    			$$invalidate(27, endpoints[i].permissions = res.ok || false, endpoints);
    		}
    	}

    	onMount(async () => {
    		const res = await fetch(`endpoints`);
    		const types = ["get", "post", "put", "delete"];
    		$$invalidate(27, endpoints = (await res.json()).filter(e => types.indexOf(e.type) != -1));

    		setTimeout(
    			e => {
    				onHashChange(); // history.forEach( h => console.log('LOAD', h.data) )
    				$$invalidate(28, history = JSON.parse(window.localStorage.getItem(storage)) || []);
    			},
    			10
    		); // history.forEach( h => console.log('LOAD', h.data) )

    		await getPermissions();
    		$$invalidate(3, inited = true);
    	});

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

    	async function whoami() {
    		$$invalidate(5, who = (await fetcheriser.get("/api/whoami")).data);
    	}

    	let timestamp;
    	let waiting = false;
    	let who = "";
    	let history = [];

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
    		$$invalidate(29, data = "");
    		$$invalidate(4, waiting = true);
    		const res = await fetcheriser[endpoint.type](regexed, copy, false);
    		status = res.status || res.code;
    		timer = (new Date() - timestamp) / 1000;

    		if (res.ok) {
    			$$invalidate(29, data = res.data);
    			let copy = history;

    			const entry = {
    				...JSON.parse(JSON.stringify(saveable)),
    				data: JSON.stringify(data),
    				status,
    				timer: timer.toFixed(2),
    				id: new Date() / 1000,
    				timestamp: new Date().toISOString().substr(11, 8)
    			};

    			console.log("[Overview]  adding entry", entry.values);
    			copy.push(entry);
    			$$invalidate(28, history = copy);

    			// history.forEach( h => console.log('SAVE', h.data) )
    			window.localStorage.setItem(storage, JSON.stringify(history));

    			$$invalidate(30, index = 0);
    		}

    		if (res.error) $$invalidate(29, data = res.message);
    		setTimeout(e => $$invalidate(4, waiting = false), 10);
    	}

    	let creds = { username: "", password: "" };
    	let loginError = "";

    	async function login(e) {
    		$$invalidate(7, loginError = "");
    		e.preventDefault();
    		e.stopPropagation();
    		const res = await fetcheriser.post("/api/login", creds);

    		if (res.ok) {
    			await whoami();
    			await getPermissions();
    		} else {
    			$$invalidate(7, loginError = res?.message || res);
    		}
    	}

    	async function logout(e) {
    		e.preventDefault();
    		e.stopPropagation();
    		const res = await fetcheriser.post("/api/logout");

    		if (res.ok) {
    			await whoami();
    			await getPermissions();
    		} else {
    			$$invalidate(7, loginError = res?.message || res);
    		}
    	}

    	let historyDimensions = { padding: 13, widths: [null, 70, 60, 100] };
    	let historyFeatures = {};

    	let historyCallbacks = {
    		click: {
    			cell: o => {
    				$$invalidate(30, index = o.rowIndex);
    				const entry = history[index];
    				const url = history[index].url;
    				$$invalidate(2, components[url] = JSON.parse(JSON.stringify(entry.components)), components);
    				$$invalidate(1, values[url] = JSON.parse(JSON.stringify(entry.values)), values);
    				$$invalidate(29, data = JSON.parse(entry.data));
    			}
    		}
    	};

    	// ----------------
    	let hash, status, timer; // store

    	let data = ""; // store
    	let values = {}; // store
    	let components = {}; // store

    	// ----------------
    	let index = -1;

    	function clear() {
    		$$invalidate(28, history = []);
    		window.localStorage.setItem(storage, null);
    	}

    	async function copy() {
    		if (!navigator.clipboard) return;
    		await navigator.clipboard.writeText(str);
    	}

    	function compare(able, entry) {
    		if (!entry || !able) return;

    		const a = JSON.stringify({
    			url: entry.url,
    			values: entry.values,
    			components: entry.components
    		});

    		const b = JSON.stringify({
    			url: able.url,
    			values: able.values,
    			components: able.components
    		});

    		if (a != b) {
    			const copy = history;
    			$$invalidate(28, history = []);
    			$$invalidate(30, index = -1);
    			$$invalidate(28, history = copy);
    		}
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Overview> was created with unknown prop '${key}'`);
    	});

    	function input0_input_handler() {
    		creds.username = this.value;
    		$$invalidate(6, creds);
    	}

    	function input1_input_handler() {
    		creds.password = this.value;
    		$$invalidate(6, creds);
    	}

    	function input_change_handler(key) {
    		values[hash][key] = this.checked;
    		$$invalidate(1, values);
    		$$invalidate(0, hash);
    		(($$invalidate(10, endpoint), $$invalidate(27, endpoints)), $$invalidate(0, hash));
    	}

    	function textarea_input_handler(key) {
    		values[hash][key] = this.value;
    		$$invalidate(1, values);
    		$$invalidate(0, hash);
    		(($$invalidate(10, endpoint), $$invalidate(27, endpoints)), $$invalidate(0, hash));
    	}

    	function input_input_handler(key) {
    		values[hash][key] = this.value;
    		$$invalidate(1, values);
    		$$invalidate(0, hash);
    		(($$invalidate(10, endpoint), $$invalidate(27, endpoints)), $$invalidate(0, hash));
    	}

    	function input_input_handler_1(each_value, piece_index) {
    		each_value[piece_index].value = this.value;
    		$$invalidate(2, components);
    		$$invalidate(0, hash);
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		fetcher: fetcheriser,
    		Table,
    		parse,
    		svg,
    		endpoints,
    		inited,
    		dimensions,
    		features,
    		callbacks,
    		onHashChange,
    		getPermissions,
    		path_,
    		whoami,
    		timestamp,
    		waiting,
    		who,
    		history,
    		submit,
    		creds,
    		loginError,
    		login,
    		logout,
    		historyDimensions,
    		historyFeatures,
    		historyCallbacks,
    		hash,
    		status,
    		timer,
    		data,
    		values,
    		components,
    		index,
    		clear,
    		copy,
    		compare,
    		init,
    		classes,
    		storage,
    		endpoint,
    		args,
    		regexed,
    		path,
    		saveable,
    		str,
    		historyInit,
    		historyClasses
    	});

    	$$self.$inject_state = $$props => {
    		if ("endpoints" in $$props) $$invalidate(27, endpoints = $$props.endpoints);
    		if ("inited" in $$props) $$invalidate(3, inited = $$props.inited);
    		if ("dimensions" in $$props) $$invalidate(15, dimensions = $$props.dimensions);
    		if ("features" in $$props) $$invalidate(16, features = $$props.features);
    		if ("callbacks" in $$props) $$invalidate(17, callbacks = $$props.callbacks);
    		if ("timestamp" in $$props) timestamp = $$props.timestamp;
    		if ("waiting" in $$props) $$invalidate(4, waiting = $$props.waiting);
    		if ("who" in $$props) $$invalidate(5, who = $$props.who);
    		if ("history" in $$props) $$invalidate(28, history = $$props.history);
    		if ("creds" in $$props) $$invalidate(6, creds = $$props.creds);
    		if ("loginError" in $$props) $$invalidate(7, loginError = $$props.loginError);
    		if ("historyDimensions" in $$props) $$invalidate(22, historyDimensions = $$props.historyDimensions);
    		if ("historyFeatures" in $$props) $$invalidate(23, historyFeatures = $$props.historyFeatures);
    		if ("historyCallbacks" in $$props) $$invalidate(24, historyCallbacks = $$props.historyCallbacks);
    		if ("hash" in $$props) $$invalidate(0, hash = $$props.hash);
    		if ("status" in $$props) status = $$props.status;
    		if ("timer" in $$props) timer = $$props.timer;
    		if ("data" in $$props) $$invalidate(29, data = $$props.data);
    		if ("values" in $$props) $$invalidate(1, values = $$props.values);
    		if ("components" in $$props) $$invalidate(2, components = $$props.components);
    		if ("index" in $$props) $$invalidate(30, index = $$props.index);
    		if ("init" in $$props) $$invalidate(8, init = $$props.init);
    		if ("classes" in $$props) $$invalidate(9, classes = $$props.classes);
    		if ("storage" in $$props) storage = $$props.storage;
    		if ("endpoint" in $$props) $$invalidate(10, endpoint = $$props.endpoint);
    		if ("args" in $$props) $$invalidate(31, args = $$props.args);
    		if ("regexed" in $$props) $$invalidate(32, regexed = $$props.regexed);
    		if ("path" in $$props) $$invalidate(11, path = $$props.path);
    		if ("saveable" in $$props) $$invalidate(33, saveable = $$props.saveable);
    		if ("str" in $$props) $$invalidate(12, str = $$props.str);
    		if ("historyInit" in $$props) $$invalidate(13, historyInit = $$props.historyInit);
    		if ("historyClasses" in $$props) $$invalidate(14, historyClasses = $$props.historyClasses);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*endpoints*/ 134217728) {
    			$$invalidate(8, init = {
    				data: endpoints,
    				keys: ["url", "category", "type", "permissions", "description"],
    				index: "url"
    			});
    		}

    		if ($$self.$$.dirty[0] & /*hash*/ 1) {
    			$$invalidate(9, classes = { filled: [hash] });
    		}

    		if ($$self.$$.dirty[0] & /*endpoints, hash*/ 134217729) {
    			$$invalidate(10, endpoint = endpoints.find(e => e.url == hash && hash != ""));
    		}

    		if ($$self.$$.dirty[0] & /*values, hash*/ 3) {
    			$$invalidate(31, args = values[hash]);
    		}

    		if ($$self.$$.dirty[0] & /*components, hash*/ 5) {
    			$$invalidate(32, regexed = "/" + (components[hash] || []).map(c => c.value || c.val).join("/"));
    		}

    		if ($$self.$$.dirty[1] & /*regexed, args*/ 3) {
    			$$invalidate(11, path = path_(regexed, args));
    		}

    		if ($$self.$$.dirty[0] & /*data*/ 536870912) {
    			$$invalidate(12, str = JSON.stringify(data, null, "\t"));
    		}

    		if ($$self.$$.dirty[0] & /*history*/ 268435456) {
    			$$invalidate(13, historyInit = {
    				data: history.reverse() || [],
    				keys: ["url", "status", "timer", "timestamp"],
    				index: "id"
    			});
    		}

    		if ($$self.$$.dirty[0] & /*history, index*/ 1342177280) {
    			$$invalidate(14, historyClasses = { filled: [history[index]?.id] });
    		}

    		if ($$self.$$.dirty[0] & /*hash, values, components*/ 7) {
    			$$invalidate(33, saveable = {
    				url: hash,
    				values: values[hash],
    				components: components[hash]
    			});
    		}

    		if ($$self.$$.dirty[0] & /*history, index*/ 1342177280 | $$self.$$.dirty[1] & /*saveable*/ 4) {
    			compare(saveable, history[index]);
    		}
    	};

    	storage = window.location.host + window.location.pathname;

    	return [
    		hash,
    		values,
    		components,
    		inited,
    		waiting,
    		who,
    		creds,
    		loginError,
    		init,
    		classes,
    		endpoint,
    		path,
    		str,
    		historyInit,
    		historyClasses,
    		dimensions,
    		features,
    		callbacks,
    		onHashChange,
    		submit,
    		login,
    		logout,
    		historyDimensions,
    		historyFeatures,
    		historyCallbacks,
    		clear,
    		copy,
    		endpoints,
    		history,
    		data,
    		index,
    		args,
    		regexed,
    		saveable,
    		input0_input_handler,
    		input1_input_handler,
    		input_change_handler,
    		textarea_input_handler,
    		input_input_handler,
    		input_input_handler_1
    	];
    }

    class Overview extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {}, [-1, -1]);

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
