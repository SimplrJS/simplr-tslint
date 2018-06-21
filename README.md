# simplr-tslint

A set of [TSLint](https://palantir.github.io/tslint/) rules used in SimplrJS projects.

## Get started

```sh
npm install simplr-tslint --save-dev
```

To get latest tslint config.

```sh
npm install simplr-tslint@next --save-dev
```

### Language service

We recommend using this plugin [tslint-language-service](https://github.com/angelozerr/tslint-language-service/).
1. Install plugin
```
npm install tslint-language-service -D
```

2. Add plugin to `tsconfig.json`

```json
{
    "compilerOptions": {
        "plugins": [
            {
                "name": "tslint-language-service",
                "alwaysShowRuleFailuresAsWarnings": true,
                "ignoreDefinitionFiles": true
            }
        ]
    }
}
```
3. Use workspace TypeScript version

![image](https://user-images.githubusercontent.com/562658/38887298-20fcf1b6-4281-11e8-9bf9-5fdba61a1159.png)

![image](https://user-images.githubusercontent.com/562658/38887343-3fbb26a4-4281-11e8-9e7d-4bd62eabd82e.png)


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
**⚠️Requires Type info**

Enforces consistent naming style in interface and class declarations.

#### Rule settings

| Name                 | Type                         | Optional | Description                                       |
| -------------------- | ---------------------------- | -------- | ------------------------------------------------- |
| formatRules          | [FormatRule](#format-rule)[] | Optional | Format rules for class and interface members.     |
| ignoreParentSuffixes | string[]                     | Optional | Ignores classes and interfaces with given suffix. |

#### Format rule

| Name            | Type                                                               | Optional | Default  |
| --------------- | ------------------------------------------------------------------ | -------- | -------- |
| kind            | "method", "property"                                               | Required |          |
| modifier        | "public", "private", "protected"                                   | Optional | "public" |
| format          | "none", "camel-case", "pascal-case", "constant-case", "snake-case" | Optional | "none"   |
| isStatic        | boolean                                                            | Optional | false    |
| allowedPrefixes | string[]                                                           | Optional |          |

#### Default config

```json
"class-members-name": [
    true,
    {
        "formatRules": [{ "kind": "property", "format": "camel-case", "allowedPrefixes": ["_"] }],
        "ignoreParentSuffixes": ["Dto"]
    }
]
```

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
    {
        "formatRules": [
            { "kind": "method", "modifier": "public", "format": "pascal-case" },
            { "kind": "method", "modifier": "protected", "format": "pascal-case" },
            { "kind": "method", "modifier": "private", "format": "camel-case" },
            { "kind": "property", "modifier": "public", "format": "pascal-case" },
            { "kind": "property", "modifier": "protected", "format": "pascal-case" },
            { "kind": "property", "modifier": "private", "format": "camel-case" }
        ]
    }
]
```

Ignoring parent suffix example.

```json
"class-members-name": [
    true,
    {
        "ignoreParentSuffixes": ["Dto"]
    }
]
```

```ts 
interface Foo {
    _id: string;
//  ~~~           [Declaration "_id" format is not correct (camel-case).]
    full_name: string;
//  ~~~~~~~~~           [Declaration "full_name" format is not correct (camel-case).]
}

interface FooDto {
    _id: string;
    full_name: string;
}

```

### `const-variable-name`

**🔨Has Fixer**
**⚠️Requires Type info**

Const variables in source file or in module must have constant-case.

#### Examples

```ts
export const FOO_FOO = "Hello World!";

export const fooBar = "Hello World!";
//           ~~~~~~                    [Const variables in source file or in module declaration must have (constant-case) format.]

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

This rule only will be applied to constants that has primitive value (e.g. `string`, `boolean`).

```json
"const-variable-name": [true, "only-primitives"]
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

### `backing-field`

**🔨Has Fixer**

Backing fields are properties with `_` prefix. They can ONLY be used in GetAccessor and SetAccessor declarations.

#### Example

```ts
export class Foo {
    constructor(private _foo: string) {}

    public get foo(): string {
        return this._foo;
    }

    public getFoo(): string {
        return this._foo;
//             ~~~~~~~~~   [Backing field can only be used in GetAccessor and SetAccessor.]
    }
}
```

#### Config example

```json
"type-parameter-name": true
```

## License

Released under the [MIT license](LICENSE).
