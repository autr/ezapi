
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
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
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
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
        const prop_values = options.props || {};
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
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, prop_values, (i, ret, ...rest) => {
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
            mount_component(component, options.target, options.anchor);
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
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.31.2' }, detail)));
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

    /* src/Overview.svelte generated by Svelte v3.31.2 */

    const { Object: Object_1, console: console_1 } = globals;
    const file = "src/Overview.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[21] = list[i][0];
    	child_ctx[22] = list[i][1];
    	child_ctx[23] = list;
    	child_ctx[24] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[25] = list[i];
    	child_ctx[27] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[28] = list[i];
    	child_ctx[30] = i;
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[21] = list[i][0];
    	child_ctx[22] = list[i][1];
    	return child_ctx;
    }

    // (104:6) {#if e.type == 'get' || e.type == 'post' || e.type == 'ws' }
    function create_if_block_4(ctx) {
    	let div3;
    	let div1;
    	let div0;
    	let t0_value = /*e*/ ctx[28].type.toUpperCase() + "";
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let div2;
    	let t4_value = /*e*/ ctx[28].description + "";
    	let t4;
    	let t5;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*e*/ ctx[28].type == "get") return create_if_block_5;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);
    	let each_value_3 = Object.entries(/*e*/ ctx[28].schema || {});
    	validate_each_argument(each_value_3);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	function click_handler_1(...args) {
    		return /*click_handler_1*/ ctx[15](/*e*/ ctx[28], ...args);
    	}

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = space();
    			if_block.c();
    			t2 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t3 = space();
    			div2 = element("div");
    			t4 = text(t4_value);
    			t5 = space();
    			attr_dev(div0, "class", "f1 w40px inline-block");
    			toggle_class(div0, "error", /*e*/ ctx[28].type == "delete");
    			toggle_class(div0, "success", /*e*/ ctx[28].type == "post");
    			toggle_class(div0, "info", /*e*/ ctx[28].type == "get");
    			add_location(div0, file, 109, 9, 2891);
    			attr_dev(div1, "class", "flex align-items-center");
    			add_location(div1, file, 108, 8, 2844);
    			add_location(div2, file, 128, 8, 3528);
    			attr_dev(div3, "class", "flex justify-content-between plr2 ptb0-4 pointer align-items-center");
    			toggle_class(div3, "pop", /*_current*/ ctx[0] == /*e*/ ctx[28].type + /*e*/ ctx[28].url + /*e*/ ctx[28].description);
    			add_location(div3, file, 104, 7, 2591);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div3, anchor);
    			append_dev(div3, div1);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div1, t1);
    			if_block.m(div1, null);
    			append_dev(div1, t2);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div1, null);
    			}

    			append_dev(div3, t3);
    			append_dev(div3, div2);
    			append_dev(div2, t4);
    			append_dev(div3, t5);

    			if (!mounted) {
    				dispose = listen_dev(div3, "click", click_handler_1, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if (dirty[0] & /*endpoints*/ 4 && t0_value !== (t0_value = /*e*/ ctx[28].type.toUpperCase() + "")) set_data_dev(t0, t0_value);

    			if (dirty[0] & /*endpoints*/ 4) {
    				toggle_class(div0, "error", /*e*/ ctx[28].type == "delete");
    			}

    			if (dirty[0] & /*endpoints*/ 4) {
    				toggle_class(div0, "success", /*e*/ ctx[28].type == "post");
    			}

    			if (dirty[0] & /*endpoints*/ 4) {
    				toggle_class(div0, "info", /*e*/ ctx[28].type == "get");
    			}

    			if (current_block_type === (current_block_type = select_block_type(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, t2);
    				}
    			}

    			if (dirty[0] & /*endpoints*/ 4) {
    				each_value_3 = Object.entries(/*e*/ ctx[28].schema || {});
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_3(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div1, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_3.length;
    			}

    			if (dirty[0] & /*endpoints*/ 4 && t4_value !== (t4_value = /*e*/ ctx[28].description + "")) set_data_dev(t4, t4_value);

    			if (dirty[0] & /*_current, endpoints*/ 5) {
    				toggle_class(div3, "pop", /*_current*/ ctx[0] == /*e*/ ctx[28].type + /*e*/ ctx[28].url + /*e*/ ctx[28].description);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if_block.d();
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(104:6) {#if e.type == 'get' || e.type == 'post' || e.type == 'ws' }",
    		ctx
    	});

    	return block;
    }

    // (122:9) {:else}
    function create_else_block_2(ctx) {
    	let div;
    	let t_value = /*e*/ ctx[28].url + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "sink highlight plr0-8 ptb0-4");
    			add_location(div, file, 122, 10, 3294);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*endpoints*/ 4 && t_value !== (t_value = /*e*/ ctx[28].url + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(122:9) {:else}",
    		ctx
    	});

    	return block;
    }

    // (117:9) {#if e.type =='get'}
    function create_if_block_5(ctx) {
    	let a;
    	let t_value = /*e*/ ctx[28].url + "";
    	let t;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t = text(t_value);
    			attr_dev(a, "href", a_href_value = /*e*/ ctx[28].url);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "class", "sink highlight plr0-8 ptb0-4");
    			add_location(a, file, 117, 10, 3153);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*endpoints*/ 4 && t_value !== (t_value = /*e*/ ctx[28].url + "")) set_data_dev(t, t_value);

    			if (dirty[0] & /*endpoints*/ 4 && a_href_value !== (a_href_value = /*e*/ ctx[28].url)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_5.name,
    		type: "if",
    		source: "(117:9) {#if e.type =='get'}",
    		ctx
    	});

    	return block;
    }

    // (125:9) {#each Object.entries(e.schema || {}) as [key, value]}
    function create_each_block_3(ctx) {
    	let div;
    	let t_value = /*key*/ ctx[21] + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "pop plr0-8 ptb0-4 fade");
    			add_location(div, file, 125, 10, 3440);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*endpoints*/ 4 && t_value !== (t_value = /*key*/ ctx[21] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(125:9) {#each Object.entries(e.schema || {}) as [key, value]}",
    		ctx
    	});

    	return block;
    }

    // (103:5) {#each ee as e, ii}
    function create_each_block_2(ctx) {
    	let if_block_anchor;
    	let if_block = (/*e*/ ctx[28].type == "get" || /*e*/ ctx[28].type == "post" || /*e*/ ctx[28].type == "ws") && create_if_block_4(ctx);

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
    			if (/*e*/ ctx[28].type == "get" || /*e*/ ctx[28].type == "post" || /*e*/ ctx[28].type == "ws") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_4(ctx);
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
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(103:5) {#each ee as e, ii}",
    		ctx
    	});

    	return block;
    }

    // (101:4) {#each endpoints as ee, i}
    function create_each_block_1(ctx) {
    	let div;
    	let span;
    	let t0_value = /*categories*/ ctx[10][/*i*/ ctx[27]] + "";
    	let t0;
    	let t1;
    	let each_1_anchor;
    	let each_value_2 = /*ee*/ ctx[25];
    	validate_each_argument(each_value_2);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			each_1_anchor = empty();
    			attr_dev(span, "class", "f3");
    			add_location(span, file, 101, 30, 2446);
    			attr_dev(div, "class", "plr2 ptb0-4");
    			add_location(div, file, 101, 5, 2421);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, span);
    			append_dev(span, t0);
    			insert_dev(target, t1, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, each_1_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*_current, endpoints, response*/ 7) {
    				each_value_2 = /*ee*/ ctx[25];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_2.length;
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t1);
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(each_1_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(101:4) {#each endpoints as ee, i}",
    		ctx
    	});

    	return block;
    }

    // (182:5) {:else}
    function create_else_block_1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "No endpoint current.";
    			add_location(div, file, 182, 6, 5250);
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
    		id: create_else_block_1.name,
    		type: "else",
    		source: "(182:5) {:else}",
    		ctx
    	});

    	return block;
    }

    // (144:5) {#if current}
    function create_if_block(ctx) {
    	let form;
    	let t0;
    	let div1;
    	let div0;
    	let t1_value = /*current*/ ctx[8].url + "";
    	let t1;
    	let t2;
    	let button;

    	let t3_value = (/*waiting*/ ctx[7]
    	? "waiting"
    	: /*current*/ ctx[8].type.toUpperCase()) + "";

    	let t3;
    	let mounted;
    	let dispose;
    	let each_value = Object.entries(/*current*/ ctx[8].schema || {});
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	let if_block = /*current*/ ctx[8].type == "get" && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
    			form = element("form");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			div1 = element("div");
    			div0 = element("div");
    			t1 = text(t1_value);
    			if (if_block) if_block.c();
    			t2 = space();
    			button = element("button");
    			t3 = text(t3_value);
    			attr_dev(div0, "class", "f3");
    			add_location(div0, file, 175, 8, 4962);
    			button.disabled = /*waiting*/ ctx[7];
    			attr_dev(button, "class", "ptb0-4 plr1");
    			add_location(button, file, 178, 8, 5078);
    			attr_dev(div1, "class", "flex align-items-flex-end justify-content-between");
    			add_location(div1, file, 174, 7, 4890);
    			add_location(form, file, 144, 6, 3876);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, form, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(form, null);
    			}

    			append_dev(form, t0);
    			append_dev(form, div1);
    			append_dev(div1, div0);
    			append_dev(div0, t1);
    			if (if_block) if_block.m(div0, null);
    			append_dev(div1, t2);
    			append_dev(div1, button);
    			append_dev(button, t3);
    			/*form_binding*/ ctx[19](form);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*send*/ ctx[12], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*current, values, setParams*/ 2312) {
    				each_value = Object.entries(/*current*/ ctx[8].schema || {});
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(form, t0);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty[0] & /*current*/ 256 && t1_value !== (t1_value = /*current*/ ctx[8].url + "")) set_data_dev(t1, t1_value);

    			if (/*current*/ ctx[8].type == "get") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1(ctx);
    					if_block.c();
    					if_block.m(div0, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty[0] & /*waiting, current*/ 384 && t3_value !== (t3_value = (/*waiting*/ ctx[7]
    			? "waiting"
    			: /*current*/ ctx[8].type.toUpperCase()) + "")) set_data_dev(t3, t3_value);

    			if (dirty[0] & /*waiting*/ 128) {
    				prop_dev(button, "disabled", /*waiting*/ ctx[7]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(form);
    			destroy_each(each_blocks, detaching);
    			if (if_block) if_block.d();
    			/*form_binding*/ ctx[19](null);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(144:5) {#if current}",
    		ctx
    	});

    	return block;
    }

    // (164:9) {:else}
    function create_else_block(ctx) {
    	let input;
    	let input_name_value;
    	let input_required_value;
    	let input_placeholder_value;
    	let mounted;
    	let dispose;

    	function input_input_handler() {
    		/*input_input_handler*/ ctx[18].call(input, /*key*/ ctx[21]);
    	}

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "name", input_name_value = /*key*/ ctx[21]);
    			attr_dev(input, "class", "flex grow p0-6");
    			input.required = input_required_value = /*value*/ ctx[22].required;
    			attr_dev(input, "placeholder", input_placeholder_value = /*value*/ ctx[22].desc);
    			add_location(input, file, 164, 10, 4624);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*values*/ ctx[3][/*key*/ ctx[21]]);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", input_input_handler),
    					listen_dev(input, "keyup", /*setParams*/ ctx[11], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*current*/ 256 && input_name_value !== (input_name_value = /*key*/ ctx[21])) {
    				attr_dev(input, "name", input_name_value);
    			}

    			if (dirty[0] & /*current*/ 256 && input_required_value !== (input_required_value = /*value*/ ctx[22].required)) {
    				prop_dev(input, "required", input_required_value);
    			}

    			if (dirty[0] & /*current*/ 256 && input_placeholder_value !== (input_placeholder_value = /*value*/ ctx[22].desc)) {
    				attr_dev(input, "placeholder", input_placeholder_value);
    			}

    			if (dirty[0] & /*values, current*/ 264 && input.value !== /*values*/ ctx[3][/*key*/ ctx[21]]) {
    				set_input_value(input, /*values*/ ctx[3][/*key*/ ctx[21]]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(164:9) {:else}",
    		ctx
    	});

    	return block;
    }

    // (155:68) 
    function create_if_block_3(ctx) {
    	let textarea;
    	let textarea_name_value;
    	let textarea_required_value;
    	let textarea_placeholder_value;
    	let mounted;
    	let dispose;

    	function textarea_input_handler() {
    		/*textarea_input_handler*/ ctx[17].call(textarea, /*key*/ ctx[21]);
    	}

    	const block = {
    		c: function create() {
    			textarea = element("textarea");
    			attr_dev(textarea, "name", textarea_name_value = /*key*/ ctx[21]);
    			attr_dev(textarea, "class", "flex grow p0-6");
    			attr_dev(textarea, "rows", "6");
    			textarea.required = textarea_required_value = /*value*/ ctx[22].required;
    			attr_dev(textarea, "placeholder", textarea_placeholder_value = /*value*/ ctx[22].desc);
    			add_location(textarea, file, 155, 10, 4358);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, textarea, anchor);
    			set_input_value(textarea, /*values*/ ctx[3][/*key*/ ctx[21]]);

    			if (!mounted) {
    				dispose = [
    					listen_dev(textarea, "input", textarea_input_handler),
    					listen_dev(textarea, "keyup", /*setParams*/ ctx[11], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*current*/ 256 && textarea_name_value !== (textarea_name_value = /*key*/ ctx[21])) {
    				attr_dev(textarea, "name", textarea_name_value);
    			}

    			if (dirty[0] & /*current*/ 256 && textarea_required_value !== (textarea_required_value = /*value*/ ctx[22].required)) {
    				prop_dev(textarea, "required", textarea_required_value);
    			}

    			if (dirty[0] & /*current*/ 256 && textarea_placeholder_value !== (textarea_placeholder_value = /*value*/ ctx[22].desc)) {
    				attr_dev(textarea, "placeholder", textarea_placeholder_value);
    			}

    			if (dirty[0] & /*values, current*/ 264) {
    				set_input_value(textarea, /*values*/ ctx[3][/*key*/ ctx[21]]);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(textarea);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(155:68) ",
    		ctx
    	});

    	return block;
    }

    // (149:9) {#if value.type == 'boolean'}
    function create_if_block_2(ctx) {
    	let input;
    	let input_name_value;
    	let input_required_value;
    	let mounted;
    	let dispose;

    	function input_change_handler() {
    		/*input_change_handler*/ ctx[16].call(input, /*key*/ ctx[21]);
    	}

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "name", input_name_value = /*key*/ ctx[21]);
    			attr_dev(input, "type", "checkbox");
    			input.required = input_required_value = /*value*/ ctx[22].required;
    			add_location(input, file, 149, 10, 4142);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*values*/ ctx[3][/*key*/ ctx[21]]);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", input_change_handler);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty[0] & /*current*/ 256 && input_name_value !== (input_name_value = /*key*/ ctx[21])) {
    				attr_dev(input, "name", input_name_value);
    			}

    			if (dirty[0] & /*current*/ 256 && input_required_value !== (input_required_value = /*value*/ ctx[22].required)) {
    				prop_dev(input, "required", input_required_value);
    			}

    			if (dirty[0] & /*values, current*/ 264) {
    				set_input_value(input, /*values*/ ctx[3][/*key*/ ctx[21]]);
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
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(149:9) {#if value.type == 'boolean'}",
    		ctx
    	});

    	return block;
    }

    // (146:7) {#each Object.entries(current.schema || {}) as [key, value]}
    function create_each_block(ctx) {
    	let div1;
    	let div0;
    	let t0_value = /*key*/ ctx[21] + "";
    	let t0;
    	let t1_value = (/*value*/ ctx[22].required ? "*" : "") + "";
    	let t1;
    	let t2;

    	function select_block_type_2(ctx, dirty) {
    		if (/*value*/ ctx[22].type == "boolean") return create_if_block_2;
    		if (/*value*/ ctx[22].type == "object" || /*value*/ ctx[22].type == "array") return create_if_block_3;
    		return create_else_block;
    	}

    	let current_block_type = select_block_type_2(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			t0 = text(t0_value);
    			t1 = text(t1_value);
    			t2 = space();
    			if_block.c();
    			attr_dev(div0, "class", "basis80px");
    			add_location(div0, file, 147, 9, 4031);
    			attr_dev(div1, "class", "flex align-items-center pb0-8");
    			add_location(div1, file, 146, 8, 3978);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, t0);
    			append_dev(div0, t1);
    			append_dev(div1, t2);
    			if_block.m(div1, null);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*current*/ 256 && t0_value !== (t0_value = /*key*/ ctx[21] + "")) set_data_dev(t0, t0_value);
    			if (dirty[0] & /*current*/ 256 && t1_value !== (t1_value = (/*value*/ ctx[22].required ? "*" : "") + "")) set_data_dev(t1, t1_value);

    			if (current_block_type === (current_block_type = select_block_type_2(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(146:7) {#each Object.entries(current.schema || {}) as [key, value]}",
    		ctx
    	});

    	return block;
    }

    // (177:22) {#if current.type == 'get'}
    function create_if_block_1(ctx) {
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text(/*params*/ ctx[4]);
    			add_location(span, file, 176, 49, 5028);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*params*/ 16) set_data_dev(t, /*params*/ ctx[4]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(177:22) {#if current.type == 'get'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let div11;
    	let div3;
    	let div2;
    	let div1;
    	let div0;
    	let t1;
    	let button;
    	let t3;
    	let t4;
    	let div10;
    	let div6;
    	let div4;
    	let span0;
    	let t6;
    	let div5;
    	let t7;
    	let div9;
    	let div7;
    	let span1;
    	let t9;
    	let div8;

    	let raw_value = (/*waiting*/ ctx[7]
    	? "waiting"
    	: /*responseStr*/ ctx[9] || "~") + "";

    	let mounted;
    	let dispose;
    	let each_value_1 = /*endpoints*/ ctx[2];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	function select_block_type_1(ctx, dirty) {
    		if (/*current*/ ctx[8]) return create_if_block;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div11 = element("div");
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			div0.textContent = "API";
    			t1 = space();
    			button = element("button");
    			button.textContent = "Permissions";
    			t3 = space();

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t4 = space();
    			div10 = element("div");
    			div6 = element("div");
    			div4 = element("div");
    			span0 = element("span");
    			span0.textContent = "Endpoint";
    			t6 = space();
    			div5 = element("div");
    			if_block.c();
    			t7 = space();
    			div9 = element("div");
    			div7 = element("div");
    			span1 = element("span");
    			span1.textContent = "Response";
    			t9 = space();
    			div8 = element("div");
    			attr_dev(div0, "class", "f3");
    			add_location(div0, file, 93, 5, 2218);
    			toggle_class(button, "filled", /*permissions*/ ctx[5]);
    			add_location(button, file, 94, 5, 2249);
    			attr_dev(div1, "class", "flex plr2 ptb0-4 align-items-flex-end justify-content-between");
    			add_location(div1, file, 92, 4, 2137);
    			attr_dev(div2, "class", "ptb1 overflow-auto bb1-solid");
    			add_location(div2, file, 90, 3, 2089);
    			attr_dev(div3, "class", "flex flex-column grow br1-solid no-basis");
    			add_location(div3, file, 88, 2, 2030);
    			attr_dev(span0, "class", "f3");
    			add_location(span0, file, 141, 29, 3791);
    			attr_dev(div4, "class", "plr2 ptb0-4");
    			add_location(div4, file, 141, 4, 3766);
    			attr_dev(div5, "class", "p2");
    			add_location(div5, file, 142, 4, 3834);
    			attr_dev(div6, "class", "ptb1 basis-auto bb1-solid");
    			set_style(div6, "flex-basis", "auto");
    			add_location(div6, file, 140, 3, 3697);
    			attr_dev(span1, "class", "f3");
    			add_location(span1, file, 188, 29, 5385);
    			attr_dev(div7, "class", "plr2 ptb0-4");
    			add_location(div7, file, 188, 4, 5360);
    			attr_dev(div8, "class", "p2");
    			set_style(div8, "font-family", "monospace");
    			set_style(div8, "white-space", "pre-wrap");
    			add_location(div8, file, 189, 4, 5428);
    			attr_dev(div9, "class", "ptb1 grow overflow-auto");
    			add_location(div9, file, 187, 3, 5318);
    			attr_dev(div10, "class", "flex flex-column grow no-basis");
    			add_location(div10, file, 137, 2, 3647);
    			attr_dev(div11, "class", "flex h100vh no-basis");
    			add_location(div11, file, 87, 1, 1993);
    			add_location(main, file, 86, 0, 1985);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div11);
    			append_dev(div11, div3);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div1, t1);
    			append_dev(div1, button);
    			append_dev(div2, t3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			append_dev(div11, t4);
    			append_dev(div11, div10);
    			append_dev(div10, div6);
    			append_dev(div6, div4);
    			append_dev(div4, span0);
    			append_dev(div6, t6);
    			append_dev(div6, div5);
    			if_block.m(div5, null);
    			append_dev(div10, t7);
    			append_dev(div10, div9);
    			append_dev(div9, div7);
    			append_dev(div7, span1);
    			append_dev(div9, t9);
    			append_dev(div9, div8);
    			div8.innerHTML = raw_value;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[14], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*permissions*/ 32) {
    				toggle_class(button, "filled", /*permissions*/ ctx[5]);
    			}

    			if (dirty[0] & /*endpoints, _current, response, categories*/ 1031) {
    				each_value_1 = /*endpoints*/ ctx[2];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div2, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value_1.length;
    			}

    			if (current_block_type === (current_block_type = select_block_type_1(ctx)) && if_block) {
    				if_block.p(ctx, dirty);
    			} else {
    				if_block.d(1);
    				if_block = current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div5, null);
    				}
    			}

    			if (dirty[0] & /*waiting, responseStr*/ 640 && raw_value !== (raw_value = (/*waiting*/ ctx[7]
    			? "waiting"
    			: /*responseStr*/ ctx[9] || "~") + "")) div8.innerHTML = raw_value;		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    			destroy_each(each_blocks, detaching);
    			if_block.d();
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

    async function post(url, args) {
    	console.log("[Overview] POST", url, args);

    	for (const [key, value] of Object.entries(args)) {
    		try {
    			args[key] = JSON.parse(value);
    		} catch(err) {
    			
    		}
    	}

    	return await fetch(url, {
    		headers: {
    			"Accept": "application/json",
    			"Content-Type": "application/json"
    		},
    		method: "POST",
    		body: JSON.stringify(args)
    	});
    }

    function instance($$self, $$props, $$invalidate) {
    	let current;
    	let responseStr;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Overview", slots, []);
    	let categories = [];
    	let endpoints = [];
    	let keyed = {};

    	onMount(async () => {
    		const res = await fetch(`/endpoints`);
    		const json = await res.json();

    		json.forEach(e => {
    			const k = e.category;
    			let idx = categories.indexOf(k);

    			if (idx == -1) {
    				categories.push(k);
    				endpoints.push([]);
    			}

    			idx = categories.indexOf(k);
    			endpoints[idx].push(e);
    			$$invalidate(13, keyed[e.type + e.url + e.description] = e, keyed);
    		});

    		$$invalidate(2, endpoints = endpoints.reverse().reverse());
    	});

    	let _current;
    	let values = {};

    	function setParams() {
    		if (!current) return $$invalidate(4, params = "");
    		$$invalidate(4, params = "?");
    		const keys = Object.keys(current.schema);

    		for (let i = 0; i < keys.length; i++) {
    			const k = keys[i];
    			if (values[k]) $$invalidate(4, params += `${i == 0 ? "" : "&"}${k}=${values[k]}`);
    		}
    	}

    	let params = "";
    	let permissions = false;
    	let formEl;

    	async function get(url, args) {
    		console.log("[Overview] GET", url, args);
    		return await fetch(url + params);
    	}

    	let response;
    	let waiting = false;

    	async function send(e) {
    		e.preventDefault();
    		e.stopPropagation();
    		$$invalidate(1, response = "");
    		const form = new FormData(formEl);
    		const args = Object.fromEntries(form.entries());
    		$$invalidate(7, waiting = true);
    		if (current.type == "get") $$invalidate(1, response = await (await get(current.url, args)).json());
    		if (current.type == "post") $$invalidate(1, response = await (await post(current.url, args)).json());
    		$$invalidate(7, waiting = false);
    	}

    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Overview> was created with unknown prop '${key}'`);
    	});

    	const click_handler = e => $$invalidate(5, permissions = !permissions);
    	const click_handler_1 = (e, a) => $$invalidate(0, _current = e.type + e.url + e.description) && $$invalidate(1, response = "");

    	function input_change_handler(key) {
    		values[key] = this.value;
    		$$invalidate(3, values);
    		(($$invalidate(8, current), $$invalidate(13, keyed)), $$invalidate(0, _current));
    	}

    	function textarea_input_handler(key) {
    		values[key] = this.value;
    		$$invalidate(3, values);
    		(($$invalidate(8, current), $$invalidate(13, keyed)), $$invalidate(0, _current));
    	}

    	function input_input_handler(key) {
    		values[key] = this.value;
    		$$invalidate(3, values);
    		(($$invalidate(8, current), $$invalidate(13, keyed)), $$invalidate(0, _current));
    	}

    	function form_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			formEl = $$value;
    			$$invalidate(6, formEl);
    		});
    	}

    	$$self.$capture_state = () => ({
    		onMount,
    		categories,
    		endpoints,
    		keyed,
    		_current,
    		values,
    		setParams,
    		params,
    		permissions,
    		formEl,
    		post,
    		get,
    		response,
    		waiting,
    		send,
    		current,
    		responseStr
    	});

    	$$self.$inject_state = $$props => {
    		if ("categories" in $$props) $$invalidate(10, categories = $$props.categories);
    		if ("endpoints" in $$props) $$invalidate(2, endpoints = $$props.endpoints);
    		if ("keyed" in $$props) $$invalidate(13, keyed = $$props.keyed);
    		if ("_current" in $$props) $$invalidate(0, _current = $$props._current);
    		if ("values" in $$props) $$invalidate(3, values = $$props.values);
    		if ("params" in $$props) $$invalidate(4, params = $$props.params);
    		if ("permissions" in $$props) $$invalidate(5, permissions = $$props.permissions);
    		if ("formEl" in $$props) $$invalidate(6, formEl = $$props.formEl);
    		if ("response" in $$props) $$invalidate(1, response = $$props.response);
    		if ("waiting" in $$props) $$invalidate(7, waiting = $$props.waiting);
    		if ("current" in $$props) $$invalidate(8, current = $$props.current);
    		if ("responseStr" in $$props) $$invalidate(9, responseStr = $$props.responseStr);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*keyed, _current*/ 8193) {
    			 $$invalidate(8, current = keyed[_current]);
    		}

    		if ($$self.$$.dirty[0] & /*response*/ 2) {
    			 $$invalidate(9, responseStr = typeof response == "object" || typeof response == "array"
    			? JSON.stringify(response, null, 2)
    			: response);
    		}
    	};

    	return [
    		_current,
    		response,
    		endpoints,
    		values,
    		params,
    		permissions,
    		formEl,
    		waiting,
    		current,
    		responseStr,
    		categories,
    		setParams,
    		send,
    		keyed,
    		click_handler,
    		click_handler_1,
    		input_change_handler,
    		textarea_input_handler,
    		input_input_handler,
    		form_binding
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
