import * as ts from "typescript";
import * as Lint from "tslint";
import * as changeCase from "change-case";

const SKIP_ORIGIN_CHECKING = "skip-origin-checking";

enum Format {
    None = "none",
    CamelCase = "camel-case",
    PascalCase = "pascal-case",
    ConstantCase = "constant-case",
    SnakeCase = "snake-case"
}

enum AccessModifier {
    Public = "public",
    Private = "private",
    Protected = "protected"
}

enum MemberKind {
    Method = "method",
    Property = "property"
}

interface FormatRule {
    kind: MemberKind;
    /**
     * @default "public"
     */
    modifier?: AccessModifier;
    /**
     * @default "none"
     */
    format?: Format;
    isStatic?: boolean;
    allowedPrefixes?: string[];
}

interface RuleOptions {
    skipOriginChecking: boolean;
    defaultFormat?: Format;
    rules: FormatRule[];
    rawOptions: Lint.IOptions;
}

namespace FormatHelpers {
    export function changeFormat(format: Format, text: string): string {
        switch (format) {
            case Format.None:
                return text;
            case Format.CamelCase:
                return changeCase.camelCase(text);
            case Format.PascalCase:
                return changeCase.pascalCase(text);
            case Format.ConstantCase:
                return changeCase.constantCase(text);
            case Format.SnakeCase:
                return changeCase.snakeCase(text);
        }
    }

    export function changeFormatWithPrefixes(format: Format, text: string, allowedPrefixes: string[] = []): string {
        if (allowedPrefixes.length === 0) {
            return changeFormat(format, text);
        }

        for (const allowedPrefix of allowedPrefixes) {
            // Find prefix from text in allowed prefixes.
            const prefix: string = text.substring(0, allowedPrefix.length);
            if (allowedPrefix !== prefix) {
                continue;
            }
            const textWithoutPrefix: string = text.substring(prefix.length, text.length);

            return allowedPrefix + changeFormat(format, textWithoutPrefix);
        }

        return changeFormat(format, text);
    }
}

namespace TsHelpers {
    export function modifierKindExistsInModifiers(modifiers: ts.NodeArray<ts.Modifier> | undefined, kind: ts.SyntaxKind): boolean {
        if (modifiers != null) {
            return modifiers.some(x => x.kind === kind);
        }

        return false;
    }

    export function resolveAccessModifierFromModifiers(modifiers?: ts.NodeArray<ts.Modifier>): AccessModifier | undefined {
        let accessModifier: AccessModifier | undefined;

        if (modifiers != null) {
            modifiers.forEach(modifier => {
                switch (modifier.kind) {
                    case ts.SyntaxKind.PublicKeyword: {
                        accessModifier = AccessModifier.Public;
                        return;
                    }
                    case ts.SyntaxKind.PrivateKeyword: {
                        accessModifier = AccessModifier.Private;
                        return;
                    }
                    case ts.SyntaxKind.ProtectedKeyword: {
                        accessModifier = AccessModifier.Protected;
                        return;
                    }
                }
            });
        }

        return accessModifier;
    }

    export type DeclarationWithHeritageClauses = ts.Declaration & { heritageClauses?: ts.NodeArray<ts.HeritageClause> };

    export function isDeclarationWithHeritageClauses(node: ts.Node): node is DeclarationWithHeritageClauses {
        return (node as DeclarationWithHeritageClauses).heritageClauses != null;
    }

    /**
     * Checks all heritage list to find specific given name. If it doesn't exist, it returns false.
     * @param node Node with heritage list.
     * @param targetName Name to search for in heritage list.
     */
    export function checkMemberNameInHeritageDeclarations(
        typeChecker: ts.TypeChecker,
        node: TsHelpers.DeclarationWithHeritageClauses | undefined,
        targetName: string
    ): boolean {
        if (node == null) {
            return false;
        }

        if (node.heritageClauses == null) {
            return false;
        }

        // Go through Extends and Implements
        for (const heritage of node.heritageClauses) {
            if (heritage.types == null) {
                continue;
            }

            // Go through types on that heritage.
            for (const typeNode of heritage.types) {
                const type = typeChecker.getTypeFromTypeNode(typeNode);
                const targetSymbol = type.getSymbol();

                if (targetSymbol != null && targetSymbol.declarations != null) {
                    // Target Symbol declarations.
                    for (const declaration of targetSymbol.declarations) {
                        // Interface and Classes declarations only.
                        if (ts.isInterfaceDeclaration(declaration) || ts.isClassDeclaration(declaration)) {
                            for (const member of declaration.members) {
                                // Check members name.
                                if (member.name != null && member.name.getText() === targetName) {
                                    return true;
                                }
                            }

                            // Go deeper to checker their heritage lists.
                            return checkMemberNameInHeritageDeclarations(typeChecker, declaration, targetName);
                        }
                    }
                }
            }
        }

        return false;
    }
}

export class Rule extends Lint.Rules.TypedRule {
    public static failureMessageFactory(name: string, neededCase: string): string {
        return `Declaration "${name}" format is not correct (${neededCase}).`;
    }

    private parseOptions(options: Lint.IOptions): RuleOptions {
        const defaultFormat: Format = options.ruleArguments.find(x => Object.values(Format).find(y => y === x) != null);
        const skipOriginChecking: boolean = options.ruleArguments.findIndex(x => x === SKIP_ORIGIN_CHECKING) !== -1;
        const formatRules: FormatRule[] | undefined = options.ruleArguments.find(x => Array.isArray(x));

        const parsedOptions: RuleOptions = {
            defaultFormat: defaultFormat,
            skipOriginChecking: skipOriginChecking,
            rules: formatRules || [],
            rawOptions: options
        };

        // Rule is only enabled without options.
        if (options.ruleArguments.length === 0) {
            parsedOptions.defaultFormat = Format.CamelCase;
        }

        return parsedOptions;
    }

    public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
        const parsedOptions = this.parseOptions(this.getOptions());
        return this.applyWithWalker(new ClassMembersWalker(sourceFile, parsedOptions, program));
    }
}

type Dictionary<TValue = any> = { [key: string]: TValue };

// The walker takes care of all the work.
class ClassMembersWalker extends Lint.ProgramAwareRuleWalker {
    constructor(sourceFile: ts.SourceFile, private ruleOptions: RuleOptions, program: ts.Program) {
        super(sourceFile, ruleOptions.rawOptions, program);
    }

    //#region Helping functions
    private getFormatRule(rule: Partial<FormatRule> & Dictionary): FormatRule | undefined {
        const rules: Array<FormatRule & Dictionary> = this.ruleOptions.rules;

        const index = rules.findIndex(x => {
            for (const key in rule) {
                if ((rule.hasOwnProperty(key) && rule[key] === x[key]) || rule[key] == null) {
                    return true;
                }
            }
            return false;
        });

        return rules[index];
    }

    private checkNameNode(nameNode: ts.Node, format: Format = Format.None, allowedPrefixes: string[] = []): void {
        const name = nameNode.getText();
        const casedName = FormatHelpers.changeFormatWithPrefixes(format, name, allowedPrefixes);

        if (casedName !== name) {
            // create a fixer for this failure
            const fix = new Lint.Replacement(nameNode.getStart(), nameNode.getWidth(), casedName);

            // create a failure at the current position
            this.addFailure(this.createFailure(nameNode.getStart(), nameNode.getWidth(), Rule.failureMessageFactory(name, format), fix));
        }
    }
    //#endregion

    public visitMethodSignature(node: ts.MethodSignature): void {
        this.checkDeclarationNameFormat(node, node.name, MemberKind.Method);
        super.visitMethodSignature(node);
    }

    public visitMethodDeclaration(node: ts.MethodDeclaration): void {
        this.checkDeclarationNameFormat(node, node.name, MemberKind.Method);
        super.visitMethodDeclaration(node);
    }

    public visitPropertySignature(node: ts.PropertySignature): void {
        this.checkDeclarationNameFormat(node, node.name, MemberKind.Property);
        super.visitPropertySignature(node);
    }

    public visitPropertyDeclaration(node: ts.PropertyDeclaration): void {
        this.checkDeclarationNameFormat(node, node.name, MemberKind.Property);
        super.visitPropertyDeclaration(node);
    }

    public visitGetAccessor(node: ts.GetAccessorDeclaration): void {
        this.checkDeclarationNameFormat(node, node.name, MemberKind.Property);
        super.visitGetAccessor(node);
    }

    public visitSetAccessor(node: ts.SetAccessorDeclaration): void {
        this.checkDeclarationNameFormat(node, node.name, MemberKind.Property);
        super.visitSetAccessor(node);
    }

    public visitConstructorDeclaration(node: ts.ConstructorDeclaration): void {
        for (const parameter of node.parameters) {
            const accessModifier = TsHelpers.resolveAccessModifierFromModifiers(parameter.modifiers);
            if (accessModifier === AccessModifier.Private) {
                this.checkDeclarationNameFormat(parameter, parameter.name, MemberKind.Property);
            }
        }

        super.visitConstructorDeclaration(node);
    }

    private checkDeclarationNameFormat(node: ts.Declaration, name: ts.Node, kind: MemberKind): void {
        const searchOption: Partial<FormatRule> = {
            kind: kind,
            modifier: TsHelpers.resolveAccessModifierFromModifiers(node.modifiers) || AccessModifier.Public,
            isStatic: TsHelpers.modifierKindExistsInModifiers(node.modifiers, ts.SyntaxKind.StaticKeyword)
        };

        const option = this.getFormatRule(searchOption);
        if (option == null && this.ruleOptions.defaultFormat == null) {
            return;
        }

        const format: Format | undefined = option != null ? option.format : this.ruleOptions.defaultFormat;
        const allowedPrefixes: string[] | undefined = option != null ? option.allowedPrefixes : undefined;

        // Check if name is existing from heritage.
        if (
            this.ruleOptions.skipOriginChecking ||
            (node.parent != null &&
                !TsHelpers.checkMemberNameInHeritageDeclarations(
                    this.getProgram().getTypeChecker(),
                    node.parent as TsHelpers.DeclarationWithHeritageClauses,
                    name.getText()
                ))
        ) {
            this.checkNameNode(name, format, allowedPrefixes);
        }
    }
}
