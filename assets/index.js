
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

    const { Object: Object_1 } = globals;
    const file = "src/Overview.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i][0];
    	child_ctx[14] = list[i][1];
    	child_ctx[15] = list;
    	child_ctx[16] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[17] = list[i];
    	child_ctx[19] = i;
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[20] = list[i];
    	child_ctx[22] = i;
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[13] = list[i][0];
    	child_ctx[14] = list[i][1];
    	return child_ctx;
    }

    // (64:6) {#if e.type == 'get' || e.type == 'post' || e.type == 'ws' }
    function create_if_block_3(ctx) {
    	let div3;
    	let div1;
    	let div0;
    	let t0_value = /*e*/ ctx[20].type.toUpperCase() + "";
    	let t0;
    	let t1;
    	let t2;
    	let t3;
    	let div2;
    	let t4_value = /*e*/ ctx[20].description + "";
    	let t4;
    	let t5;
    	let mounted;
    	let dispose;

    	function select_block_type(ctx, dirty) {
    		if (/*e*/ ctx[20].type == "get") return create_if_block_4;
    		return create_else_block_2;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);
    	let each_value_3 = Object.entries(/*e*/ ctx[20].schema || {});
    	validate_each_argument(each_value_3);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	function click_handler_1(...args) {
    		return /*click_handler_1*/ ctx[10](/*e*/ ctx[20], ...args);
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
    			add_location(div0, file, 69, 9, 1781);
    			attr_dev(div1, "class", "flex align-items-center");
    			add_location(div1, file, 68, 8, 1734);
    			add_location(div2, file, 82, 8, 2261);
    			attr_dev(div3, "class", "flex justify-content-between plr2 ptb0-4 pointer align-items-center");
    			toggle_class(div3, "pop", /*_current*/ ctx[0] == /*e*/ ctx[20].type + /*e*/ ctx[20].url + /*e*/ ctx[20].desc);
    			add_location(div3, file, 64, 7, 1516);
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
    			if (dirty & /*endpoints*/ 2 && t0_value !== (t0_value = /*e*/ ctx[20].type.toUpperCase() + "")) set_data_dev(t0, t0_value);

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

    			if (dirty & /*Object, endpoints*/ 2) {
    				each_value_3 = Object.entries(/*e*/ ctx[20].schema || {});
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

    			if (dirty & /*endpoints*/ 2 && t4_value !== (t4_value = /*e*/ ctx[20].description + "")) set_data_dev(t4, t4_value);

    			if (dirty & /*_current, endpoints*/ 3) {
    				toggle_class(div3, "pop", /*_current*/ ctx[0] == /*e*/ ctx[20].type + /*e*/ ctx[20].url + /*e*/ ctx[20].desc);
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
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(64:6) {#if e.type == 'get' || e.type == 'post' || e.type == 'ws' }",
    		ctx
    	});

    	return block;
    }

    // (76:9) {:else}
    function create_else_block_2(ctx) {
    	let div;
    	let t_value = /*e*/ ctx[20].url + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "sink highlight plr0-8 ptb0-4");
    			add_location(div, file, 76, 10, 2027);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*endpoints*/ 2 && t_value !== (t_value = /*e*/ ctx[20].url + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block_2.name,
    		type: "else",
    		source: "(76:9) {:else}",
    		ctx
    	});

    	return block;
    }

    // (71:9) {#if e.type =='get'}
    function create_if_block_4(ctx) {
    	let a;
    	let t_value = /*e*/ ctx[20].url + "";
    	let t;
    	let a_href_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t = text(t_value);
    			attr_dev(a, "href", a_href_value = /*e*/ ctx[20].url);
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "class", "sink highlight plr0-8 ptb0-4");
    			add_location(a, file, 71, 10, 1886);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, a, anchor);
    			append_dev(a, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*endpoints*/ 2 && t_value !== (t_value = /*e*/ ctx[20].url + "")) set_data_dev(t, t_value);

    			if (dirty & /*endpoints*/ 2 && a_href_value !== (a_href_value = /*e*/ ctx[20].url)) {
    				attr_dev(a, "href", a_href_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_4.name,
    		type: "if",
    		source: "(71:9) {#if e.type =='get'}",
    		ctx
    	});

    	return block;
    }

    // (79:9) {#each Object.entries(e.schema || {}) as [key, value]}
    function create_each_block_3(ctx) {
    	let div;
    	let t_value = /*key*/ ctx[13] + "";
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text(t_value);
    			attr_dev(div, "class", "pop plr0-8 ptb0-4 fade");
    			add_location(div, file, 79, 10, 2173);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*endpoints*/ 2 && t_value !== (t_value = /*key*/ ctx[13] + "")) set_data_dev(t, t_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(79:9) {#each Object.entries(e.schema || {}) as [key, value]}",
    		ctx
    	});

    	return block;
    }

    // (63:5) {#each ee as e, ii}
    function create_each_block_2(ctx) {
    	let if_block_anchor;
    	let if_block = (/*e*/ ctx[20].type == "get" || /*e*/ ctx[20].type == "post" || /*e*/ ctx[20].type == "ws") && create_if_block_3(ctx);

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
    			if (/*e*/ ctx[20].type == "get" || /*e*/ ctx[20].type == "post" || /*e*/ ctx[20].type == "ws") {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_3(ctx);
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
    		source: "(63:5) {#each ee as e, ii}",
    		ctx
    	});

    	return block;
    }

    // (61:4) {#each endpoints as ee, i}
    function create_each_block_1(ctx) {
    	let div;
    	let span;
    	let t0_value = /*categories*/ ctx[6][/*i*/ ctx[19]] + "";
    	let t0;
    	let t1;
    	let each_1_anchor;
    	let each_value_2 = /*ee*/ ctx[17];
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
    			attr_dev(span, "class", "f4");
    			add_location(span, file, 61, 30, 1371);
    			attr_dev(div, "class", "plr2 ptb0-4");
    			add_location(div, file, 61, 5, 1346);
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
    			if (dirty & /*_current, endpoints, Object*/ 3) {
    				each_value_2 = /*ee*/ ctx[17];
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
    		source: "(61:4) {#each endpoints as ee, i}",
    		ctx
    	});

    	return block;
    }

    // (123:5) {:else}
    function create_else_block_1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "No endpoint current.";
    			add_location(div, file, 123, 6, 3508);
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
    		source: "(123:5) {:else}",
    		ctx
    	});

    	return block;
    }

    // (98:5) {#if current}
    function create_if_block(ctx) {
    	let t0;
    	let div1;
    	let div0;
    	let t1_value = /*current*/ ctx[5].url + "";
    	let t1;
    	let t2;
    	let button;
    	let t3;
    	let t4_value = /*current*/ ctx[5].type.toUpperCase() + "";
    	let t4;
    	let mounted;
    	let dispose;
    	let each_value = Object.entries(/*current*/ ctx[5].schema || {});
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	let if_block = /*current*/ ctx[5].type == "get" && create_if_block_1(ctx);

    	const block = {
    		c: function create() {
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
    			t3 = text("Send ");
    			t4 = text(t4_value);
    			attr_dev(div0, "class", "f3");
    			add_location(div0, file, 117, 7, 3276);
    			attr_dev(button, "class", "ptb0-4 plr1");
    			add_location(button, file, 120, 7, 3389);
    			attr_dev(div1, "class", "flex align-items-flex-end justify-content-between");
    			add_location(div1, file, 116, 6, 3205);
    		},
    		m: function mount(target, anchor) {
    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(target, anchor);
    			}

    			insert_dev(target, t0, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, div0);
    			append_dev(div0, t1);
    			if (if_block) if_block.m(div0, null);
    			append_dev(div1, t2);
    			append_dev(div1, button);
    			append_dev(button, t3);
    			append_dev(button, t4);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", send, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*Object, current, values, setParams*/ 164) {
    				each_value = Object.entries(/*current*/ ctx[5].schema || {});
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(t0.parentNode, t0);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*current*/ 32 && t1_value !== (t1_value = /*current*/ ctx[5].url + "")) set_data_dev(t1, t1_value);

    			if (/*current*/ ctx[5].type == "get") {
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

    			if (dirty & /*current*/ 32 && t4_value !== (t4_value = /*current*/ ctx[5].type.toUpperCase() + "")) set_data_dev(t4, t4_value);
    		},
    		d: function destroy(detaching) {
    			destroy_each(each_blocks, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(div1);
    			if (if_block) if_block.d();
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(98:5) {#if current}",
    		ctx
    	});

    	return block;
    }

    // (107:8) {:else}
    function create_else_block(ctx) {
    	let input;
    	let input_required_value;
    	let input_placeholder_value;
    	let mounted;
    	let dispose;

    	function input_input_handler() {
    		/*input_input_handler*/ ctx[12].call(input, /*key*/ ctx[13]);
    	}

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "class", "flex grow");
    			input.required = input_required_value = /*value*/ ctx[14].required;
    			attr_dev(input, "placeholder", input_placeholder_value = /*value*/ ctx[14].desc);
    			add_location(input, file, 107, 9, 2975);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*values*/ ctx[2][/*key*/ ctx[13]]);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "input", input_input_handler),
    					listen_dev(input, "keyup", /*setParams*/ ctx[7], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*current*/ 32 && input_required_value !== (input_required_value = /*value*/ ctx[14].required)) {
    				prop_dev(input, "required", input_required_value);
    			}

    			if (dirty & /*current*/ 32 && input_placeholder_value !== (input_placeholder_value = /*value*/ ctx[14].desc)) {
    				attr_dev(input, "placeholder", input_placeholder_value);
    			}

    			if (dirty & /*values, Object, current*/ 36 && input.value !== /*values*/ ctx[2][/*key*/ ctx[13]]) {
    				set_input_value(input, /*values*/ ctx[2][/*key*/ ctx[13]]);
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
    		source: "(107:8) {:else}",
    		ctx
    	});

    	return block;
    }

    // (102:8) {#if value.type == 'boolean'}
    function create_if_block_2(ctx) {
    	let input;
    	let input_required_value;
    	let mounted;
    	let dispose;

    	function input_change_handler() {
    		/*input_change_handler*/ ctx[11].call(input, /*key*/ ctx[13]);
    	}

    	const block = {
    		c: function create() {
    			input = element("input");
    			attr_dev(input, "type", "checkbox");
    			input.required = input_required_value = /*value*/ ctx[14].required;
    			add_location(input, file, 102, 9, 2838);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, input, anchor);
    			set_input_value(input, /*values*/ ctx[2][/*key*/ ctx[13]]);

    			if (!mounted) {
    				dispose = listen_dev(input, "change", input_change_handler);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*current*/ 32 && input_required_value !== (input_required_value = /*value*/ ctx[14].required)) {
    				prop_dev(input, "required", input_required_value);
    			}

    			if (dirty & /*values, Object, current*/ 36) {
    				set_input_value(input, /*values*/ ctx[2][/*key*/ ctx[13]]);
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
    		source: "(102:8) {#if value.type == 'boolean'}",
    		ctx
    	});

    	return block;
    }

    // (99:6) {#each Object.entries(current.schema || {}) as [key, value]}
    function create_each_block(ctx) {
    	let div1;
    	let div0;
    	let t0_value = /*key*/ ctx[13] + "";
    	let t0;
    	let t1_value = (/*value*/ ctx[14].required ? "*" : "") + "";
    	let t1;
    	let t2;

    	function select_block_type_2(ctx, dirty) {
    		if (/*value*/ ctx[14].type == "boolean") return create_if_block_2;
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
    			add_location(div0, file, 100, 8, 2729);
    			attr_dev(div1, "class", "flex align-items-center pb0-8");
    			add_location(div1, file, 99, 7, 2677);
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
    			if (dirty & /*current*/ 32 && t0_value !== (t0_value = /*key*/ ctx[13] + "")) set_data_dev(t0, t0_value);
    			if (dirty & /*current*/ 32 && t1_value !== (t1_value = (/*value*/ ctx[14].required ? "*" : "") + "")) set_data_dev(t1, t1_value);

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
    		source: "(99:6) {#each Object.entries(current.schema || {}) as [key, value]}",
    		ctx
    	});

    	return block;
    }

    // (119:21) {#if current.type == 'get'}
    function create_if_block_1(ctx) {
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text(/*params*/ ctx[3]);
    			add_location(span, file, 118, 48, 3341);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, span, anchor);
    			append_dev(span, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*params*/ 8) set_data_dev(t, /*params*/ ctx[3]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(119:21) {#if current.type == 'get'}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let main;
    	let div10;
    	let div3;
    	let div2;
    	let div1;
    	let div0;
    	let t1;
    	let button;
    	let t3;
    	let t4;
    	let div9;
    	let div6;
    	let div4;
    	let span0;
    	let t6;
    	let div5;
    	let t7;
    	let div8;
    	let div7;
    	let span1;
    	let mounted;
    	let dispose;
    	let each_value_1 = /*endpoints*/ ctx[1];
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	function select_block_type_1(ctx, dirty) {
    		if (/*current*/ ctx[5]) return create_if_block;
    		return create_else_block_1;
    	}

    	let current_block_type = select_block_type_1(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			main = element("main");
    			div10 = element("div");
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
    			div9 = element("div");
    			div6 = element("div");
    			div4 = element("div");
    			span0 = element("span");
    			span0.textContent = "Endpoint";
    			t6 = space();
    			div5 = element("div");
    			if_block.c();
    			t7 = space();
    			div8 = element("div");
    			div7 = element("div");
    			span1 = element("span");
    			span1.textContent = "Response";
    			attr_dev(div0, "class", "f4");
    			add_location(div0, file, 53, 5, 1143);
    			toggle_class(button, "filled", /*permissions*/ ctx[4]);
    			add_location(button, file, 54, 5, 1174);
    			attr_dev(div1, "class", "flex plr2 ptb0-4 align-items-flex-end justify-content-between");
    			add_location(div1, file, 52, 4, 1062);
    			attr_dev(div2, "class", "ptb1 overflow-auto bb1-solid");
    			add_location(div2, file, 50, 3, 1014);
    			attr_dev(div3, "class", "flex flex-column grow br1-solid no-basis");
    			add_location(div3, file, 48, 2, 955);
    			attr_dev(span0, "class", "f4");
    			add_location(span0, file, 95, 29, 2524);
    			attr_dev(div4, "class", "plr2 ptb0-4");
    			add_location(div4, file, 95, 4, 2499);
    			attr_dev(div5, "class", "p2");
    			add_location(div5, file, 96, 4, 2567);
    			attr_dev(div6, "class", "ptb1 basis-auto bb1-solid");
    			set_style(div6, "flex-basis", "auto");
    			add_location(div6, file, 94, 3, 2430);
    			attr_dev(span1, "class", "f4");
    			add_location(span1, file, 129, 29, 3648);
    			attr_dev(div7, "class", "plr2 ptb0-4");
    			add_location(div7, file, 129, 4, 3623);
    			attr_dev(div8, "class", "ptb1 flex grow overflow-auto");
    			add_location(div8, file, 128, 3, 3576);
    			attr_dev(div9, "class", "flex flex-column grow no-basis");
    			add_location(div9, file, 91, 2, 2380);
    			attr_dev(div10, "class", "flex h100vh no-basis");
    			add_location(div10, file, 47, 1, 918);
    			add_location(main, file, 46, 0, 910);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			append_dev(main, div10);
    			append_dev(div10, div3);
    			append_dev(div3, div2);
    			append_dev(div2, div1);
    			append_dev(div1, div0);
    			append_dev(div1, t1);
    			append_dev(div1, button);
    			append_dev(div2, t3);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div2, null);
    			}

    			append_dev(div10, t4);
    			append_dev(div10, div9);
    			append_dev(div9, div6);
    			append_dev(div6, div4);
    			append_dev(div4, span0);
    			append_dev(div6, t6);
    			append_dev(div6, div5);
    			if_block.m(div5, null);
    			append_dev(div9, t7);
    			append_dev(div9, div8);
    			append_dev(div8, div7);
    			append_dev(div7, span1);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[9], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*permissions*/ 16) {
    				toggle_class(button, "filled", /*permissions*/ ctx[4]);
    			}

    			if (dirty & /*endpoints, _current, Object, categories*/ 67) {
    				each_value_1 = /*endpoints*/ ctx[1];
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
    		},
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

    function send() {
    	
    }

    function instance($$self, $$props, $$invalidate) {
    	let current;
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
    			$$invalidate(8, keyed[e.type + e.url + e.desc] = e, keyed);
    		});

    		$$invalidate(1, endpoints = endpoints.reverse().reverse());
    	});

    	let _current;
    	let values = {};

    	function setParams() {
    		if (!current) return $$invalidate(3, params = "");
    		$$invalidate(3, params = "?");
    		const keys = Object.keys(current.schema);

    		for (let i = 0; i < keys.length; i++) {
    			const k = keys[i];
    			if (values[k]) $$invalidate(3, params += `${i == 0 ? "" : ","}${k}=${values[k]}`);
    		}
    	}

    	let params = "";
    	let permissions = false;
    	const writable_props = [];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Overview> was created with unknown prop '${key}'`);
    	});

    	const click_handler = e => $$invalidate(4, permissions = !permissions);
    	const click_handler_1 = (e, a) => $$invalidate(0, _current = e.type + e.url + e.desc);

    	function input_change_handler(key) {
    		values[key] = this.value;
    		$$invalidate(2, values);
    		(($$invalidate(5, current), $$invalidate(8, keyed)), $$invalidate(0, _current));
    	}

    	function input_input_handler(key) {
    		values[key] = this.value;
    		$$invalidate(2, values);
    		(($$invalidate(5, current), $$invalidate(8, keyed)), $$invalidate(0, _current));
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
    		send,
    		current
    	});

    	$$self.$inject_state = $$props => {
    		if ("categories" in $$props) $$invalidate(6, categories = $$props.categories);
    		if ("endpoints" in $$props) $$invalidate(1, endpoints = $$props.endpoints);
    		if ("keyed" in $$props) $$invalidate(8, keyed = $$props.keyed);
    		if ("_current" in $$props) $$invalidate(0, _current = $$props._current);
    		if ("values" in $$props) $$invalidate(2, values = $$props.values);
    		if ("params" in $$props) $$invalidate(3, params = $$props.params);
    		if ("permissions" in $$props) $$invalidate(4, permissions = $$props.permissions);
    		if ("current" in $$props) $$invalidate(5, current = $$props.current);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*keyed, _current*/ 257) {
    			 $$invalidate(5, current = keyed[_current]);
    		}
    	};

    	return [
    		_current,
    		endpoints,
    		values,
    		params,
    		permissions,
    		current,
    		categories,
    		setParams,
    		keyed,
    		click_handler,
    		click_handler_1,
    		input_change_handler,
    		input_input_handler
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
