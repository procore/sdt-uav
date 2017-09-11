![uav logo](https://uav.js.org/images/uav.small.png)

uav aims to demonstrate that complexity is a problem in today's front end codebases. Think of it as an alternative to React, Vue, or Angular, but easier to use, and only 2KB compressed.

* [Hello World](#hello-world)
* [Creating a Component](#creating-a-component)
* [Template Expressions](#template-expressions)
  * [Attribute Expressions](#attribute-expressions)
  * [Boolean Attributes](#boolean-attributes)
  * [Template Loops](#template-loops)
* [Events](#events)
* [Child Components](#child-components)
* [Passing Data to Children](#passing-data-to-children)
* [Creating a Model](#creating-a-model)
* [Binding HTML](#binding-html)
* [Special Attributes](#special-attributes)
  * [uav-src](#uav-src)
  * [uav-style](#uav-style)
* [DOM Access](#dom-access)
* [Two Way Data Binding](#two-way-data-binding)
* [Performance Notes](#performance-notes)
* [Browser Compatibility](#browser-compatibility)

> The goal of uav is not adoption. The goal is to show that the problems faced by modern web apps are not complex enough to justify the millions of developer hours our industry has invested complicated frameworks. 

## Hello World

```
const component = uav.component(
    { message: 'Hello, world!' }, 
    `<h1>{message}</h1>`, 
    '#app'
);

// Renders into the #app element:
<h1>Hello, world!</h1>

// After running the following ...
component.message = 'Goodbye, world.';

// ... the HTML automatically updates:
<h1>Goodbye, world.</h1>
```

## Creating a Component

`uav.component(model, template, selector, callback)`

Arguments:
- `model` (Object): A view model. Optional.
- `template` (String): An HTML template. Must have exactly one root node.
- `selector` (String|Element): The element in which to render the component. Optional.
- `callback` (Function): A function to call after the initial render. Passed the component's top-level DOM element. Optional.

Returns the model.

Changes to existing properties on the model will trigger an optimized re-render. Only the smallest DOM change possible will occur, down to the level of updating a single element attribute or text node. This is accomplished without any DOM diffing, because uav constructs a tree of closures that know exactly what needs to be updated whenever a particular property is changed.

## Template Expressions

By default, uav expressions use `{curly}` notation. Any browser-supported JavaScript can be used in an any expression. The result of the expression should be one of the following:
- String
- Number
- Function (for event handlers)
- Boolean (for simplified class and property bindings)
- DOM element (don't render untrusted HTML in templates)
- uav component
- undefined or null (renders an empty string)

Regardless of what you are binding or where you are binding it, the syntax is always the same.

> You can change the template tag syntax with `uav.setTag()`. For example, to use `{{mustache}}` notation, call `uav.setTag('{{', '}}')` before creating any components.

### Text Expressions:
```
uav.component(
    { content: 'foo' },
    `<div>This is a content expression: {content}</div>`
);
```

### Attribute Expressions:
```
const component = uav.component({
    visible: true,
    className: 'component'
},
    `<div class="{className} {visible}"></div>`
);

// Renders the following:
<div class="component visible"></div>
```

> If an expression evaluates to a boolean, it will render nothing if false, or the property name if true. This makes toggling the "visible" class on the above `<div>` as easy as `component.visble = !component.visible`.

### Boolean Attributes
```
uav.component(
    { disabled: true },
    `<input type="text" {disabled}>`
);

// Renders:
<input type="text" disabled>
```

### Template Loops

Use the `uav-loop` and `uav-as` attributes to loop over an array as follows:

```
uav.component({
    items: [ 1, 2, 'three' ]
}, `
    <ul uav-loop="items" uav-as="item">
        <li>{item}</li>
    </ul>
`);
```

This component will render the following:

```
<ul>
    <li>1</li>
    <li>2</li>
    <li>three</li>
</ul>
```

You can set a variable for the index of the current array item by adding a comma and a variable name to the `uav-as` attribute:

```
uav.component({
    items: [ 1, 2, 'three' ]
}, `
    <ul uav-loop="items" uav-as="item,index">
        <li class="item-{index}">{item}</li>
    </ul>
`);
```

Renders:

```
<ul>
    <li class="item-0">1</li>
    <li class="item-1">2</li>
    <li class="item-2">three</li>
</ul>
```

Things you may wonder about:
- Properties of the parent model are available within a loop.
- Like a component, a loop's content must have one root node.
- Array methods that modify the array like `push` and `splice` will trigger a re-render of the loop.
- Curly braces are optional in the `uav-loop` and `uav-as` attributes, since we know the values will always be template expressions.

### Events

```
uav.component(
    { click: e => console.log(e) }, 
    `<button onclick="{click}">Click me</button>`
);
```

Like any expression, you can pass data to an event handler:

```
uav.component({
    click: item => e => console.log(item),
    items: [ 'foo', 'bar', 'baz' ]
}, `
    <ul uav-loop="items" uav-as="item">
        <li onclick="{click(item)}">This is {item}</li>
    </ul>
`)
```

## Child Components

A component can be rendered into other components.

```
const child = uav.component(`<h3>I am a child.</h3>`);

uav.component(
    { child }, `
    <div>
        <h1>This is a component with a child.</h1>
        {child}
    </div>
`);
```

This will render the following:

```
<div>
    <h1>This is a component with a child.</h1>
    <h3>I am a child.</h3>
</div>
```

### Passing Data to Children

```
const child = data => uav.component(
    { data }, 
    `<em>{data}</em>`
);

uav.component({
    child: child('This is passed from parent to child.')
}, `
    <div>
        This component passes data to its child.
        {child}
    </div>
`);
```

The parent component above passes data when the model is created. You could just as easily pass the data through the template:

```
uav.component(
    { child }, 
    `<div>
        This component passes data to its child.
        {child('This is passed from parent to child.')}
    </div>`
);
```

Either way, it will render the following:

```
<div>
    This component passes data to its child.
    <em>This is passed from parent to child.</em>
</div>
```

uav supports swapping child components on the fly. For example, you could call `component.child = someOtherComponent` and the view will update accordingly. Just remember that uav is aggressive about avoiding memory leaks, and will remove any bindings that were attached to the original component before it was replaced. 

## Creating a Model

If you want to create a view model before associating it with a template, use `uav.model`. It can come in handy when a model refers to itself at render time.

```
const model = uav.model({
    active: true,
    isActive: () => model.active
});

const component = uav.component(model, '<div class="item {isActive() ? 'active' : 'inactive'}"></div>')
```

Note, however, that this can be a code smell. The above component could be more simply written without the `isActive` function: 

```
const component = uav.component(
    { active: true },
    '<div class="item {active ? 'active' : 'inactive'}"></div>'
);
```

A good dev will go further, knowing that it is unnecessary to define two different CSS classes describing boolean states:

```
const component = uav.component(
    { active: true },
    '<div class="item {active}"></div>'
);
```

### Binding HTML
To render an HTML string as a DOM element, you can use `uav.parse()`.

```
uav.component({
    html: uav.parse('<script>location="https://en.wikipedia.org/wiki/Cross-site_scripting"</script>')
}, 
    `<div>{html}</div>`
);
```

## Special Attributes

### uav-src

Imagine that an image's source is bound to a template expression:

`uav.component('<img src="{imageSource}" />');`

To prevent your browser from making a request to `/{imageSource}` before your JavaScript runs, you can use the `uav-src` attribute.

`uav.component('<img uav-src="{imageSource}" />');`

### uav-style

Internet Explorer can be extremely picky about the value of an inline `style` tag. A template expression like the following will work in any browser except IE:

`uav.component('<div style="left: {left}px"></div>');`

To support Internet Explorer, you can use the `uav-style` attribute instead:

`uav.component('<div uav-style="left: {left}px"></div>');`

## DOM Access

Elements can be accessed directly by passing a selector to the `uav` or `uav.all` functions.

Access the first matched element:

`uav('.item').classList.toggle('visible');`

Run a callback on all matched elements:

`uav('.item', item => item.classList.toggle('visible'));`

Get an array of all matched elements:

`uav.all('.item').forEach(item => item.classList.toggle('visible'));`

## Two Way Data Binding

Two way binding is cool, but is only applicable to form interfaces, and can encourage lazy coding practices. Furthermore, it requires creating `oninput` event listeners behind the scenes, when often your use case only requires `change` or `submit` listeners. For these reasons it is included as a separate file, `uav-bind.js`.

After including this file, any HTML input types that support the `value` property can be two-way bound using the `uav-bind` attribute. When a user changes a value, the model will automatically update to reflect it.

```
uav.component(
    { value: 'hi there' }
    `<input type="text" uav-bind="value"/>`
);
```

Because checkbox inputs describe a list of selected items, they can only be bound to arrays.

```
uav.component({
    items: [1, 2]
}, `
    <input type="checkbox" uav-bind="items" value="1" name="check">1<br>
    <input type="checkbox" uav-bind="items" value="2" name="check">2<br>
    <input type="checkbox" uav-bind="items" value="3" name="check">3<br>`
);
```

> `uav-bind.js` is 0.5KB compressed. 

## Performance Notes

### Only bind data when you have to

Avoid putting any data on the model that doesn't need to be bound to the DOM. If a particular value will never change, or changes to it don't need to update the DOM, just use a regular ES6 template variable to reference it (put a dollar sign in front of the expression).

```
const wontChange = 'hi!';

uav.component({
    willChange: 'loading...'
}, `
    <div>
        <p>${wontChange}</p>
        <p>{willChange}</p>
    </div>
`)
```

### Unbind any DOM nodes you've manually detached

When uav updates the DOM as a result of a change to a model, it automatically removes any bindings to DOM nodes that have been removed or replaced. However, if for some reason you manually remove or replace a bound DOM node, you can clean up any bindings associated with it by calling `uav.unbind(<Element>)`. There is no harm in calling `uav.unbind` on an element that does not have any associated bindings.

## Collapsing Whitespace

Using multiline template strings creates unnecessary whitespace in your JavaScript files. To collapse this whitespace, add a step like this to your build process:

`tr -s " " < dist/bundle.js > dist/tmp && mv dist/tmp dist/bundle.js`

## Browser Compatibility

IE9+

## Coming Soon

- uav-router: The simplest possible routing solution for single page apps
- uav-server: Render your uav apps from Node to make them search-engine friendly.
