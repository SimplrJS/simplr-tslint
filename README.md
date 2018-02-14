# simplr-tslint

A set of [TSLint](https://palantir.github.io/tslint/) rules used in SimplrJS projects.

## Get started

```cmd
npm install simplr-tslint --save-dev
```

## How to use?

Add this line in your `tslint.json` file:

```json
{
    "extends": "simplr-tslint"
}
```

Or:

```json
{
    "extends": ["simplr-tslint"]
}
```

## Custom rules

### `class-members-name`

**🔨Has Fixer**

Enforces consistent naming style in interface and class declarations.

#### Format rule

| Name     | Type                                                               | Optional | Default  |
| -------- | ------------------------------------------------------------------ | -------- | -------- |
| kind     | "method", "property"                                               | Required |          |
| modifier | "public", "private", "protected"                                   | Optional | "public" |
| format   | "none", "camel-case", "pascal-case", "constant-case", "snake-case" | Optional | "none"   |
| isStatic | boolean                                                            | Optional | false    |
| prefix   | string                                                             | Optional |          |

#### Config examples

Enforces all members naming to `camel-case` format.

```json
"class-members-name": true
```

Enforces all members naming to `pascal-case` format.

```json
"class-members-name": [true, "pascal-case"]
```

Enforces all members naming to `pascal-case` format. Skips origin checking in heritage. Useful when migrating coding style.

```json
"class-members-name": [true, "pascal-case", "skip-origin-checking"]
```

C# coding style example.

```json
"class-members-name": [
    true,
    [
        { "kind": "method", "modifier": "public", "format": "pascal-case" },
        { "kind": "method", "modifier": "protected", "format": "pascal-case" },
        { "kind": "method", "modifier": "private", "format": "camel-case" },
        { "kind": "property", "modifier": "public", "format": "pascal-case" },
        { "kind": "property", "modifier": "protected", "format": "pascal-case" },
        { "kind": "property", "modifier": "private", "format": "camel-case" }
    ]
]
```

Private with leading underscore and Protected with leading two underscores.

```json
"class-members-name": [
    true,
    [
        { "kind": "method", "modifier": "public", "format": "camel-case" },
        { "kind": "method", "modifier": "protected", "format": "camel-case", "prefix": "__" },
        { "kind": "method", "modifier": "private", "format": "camel-case", "prefix": "_" },
        { "kind": "property", "modifier": "public", "format": "camel-case" },
        { "kind": "property", "modifier": "protected", "format": "camel-case", "prefix": "__" },
        { "kind": "property", "modifier": "private", "format": "camel-case", "prefix": "_" }
    ]
]
```

### `const-variable-name`

**🔨Has Fixer**

Const variables in source file or in module must have constant-case.

#### Examples

```ts
export const FOO_FOO = "Hello World!";

export const fooBar = "Hello World!";
//   ~~~~~~                    [Const variables in source file or in module declaration must have (constant-case) format.]

export namespace FooNamespace {
    export const PACKAGE_VERSION: string = "v1.0.0";

    export function test(): void {
        const variableInFunctionScope: string = "Hello.";
    }
}
```

#### Config example

```json
"const-variable-name": true
```

### `exported-namespace-member`

**🔨Has Fixer**

All module members must be exported.

#### Config example

```json
"exported-namespace-member": true
```

### `type-parameter-name`

**🔨Has Fixer**

Type parameter's name must start with "T" prefix.

#### Example

```ts
export type Foo<Value> = [string, Value];
//  ~~~~~                      [Type parameter's name must start with "T" prefix.]

export type Bar<TValue> = [string, TValue];
```

#### Config example

```json
"type-parameter-name": true
```

## License

Released under the [MIT license](LICENSE).
