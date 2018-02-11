import * as ts from "typescript";
import * as Lint from "tslint";
import * as changeCase from "change-case";

enum Format {
    None = "none",
    CamelCase = "camel-case",
    PascalCase = "pascal-case",
    ConstantCase = "constant-case",
    SnakeCase = "snake-case"
}

enum AccessModifier {
    Any = "any",
    Public = "public",
    Private = "private",
    Protected = "protected",
    Static = "static"
}

enum MemberKind {
    Getter = "getter",
    Setter = "setter",
    Method = "method",
    Property = "property"
}

interface Option {
    kind: MemberKind;
    /**
     * @default "any"
     */
    modifier?: AccessModifier;
    /**
     * @default "none"
     */
    format?: Format;
    isStatic?: boolean;
    leadingUnderscore?: boolean;
}

namespace FormatHelpers {
    export function getLeadingUnderscore(text: string): string {
        let result: string = "";

        for (let i = 0; i < text.length; i++) {
            if (text[i] !== "_") {
                break;
            }

            result += text[i];
        }

        return result;
    }

    export function changeFormat(format: Format, text: string, leadingUnderscore?: boolean): string {
        const leadingUnderscoreText: string = leadingUnderscore ? getLeadingUnderscore(text) : "";

        switch (format) {
            case Format.None:
                return text;
            case Format.CamelCase:
                return leadingUnderscoreText + changeCase.camelCase(text);
            case Format.PascalCase:
                return leadingUnderscoreText + changeCase.pascalCase(text);
            case Format.ConstantCase:
                return leadingUnderscoreText + changeCase.constantCase(text);
            case Format.SnakeCase:
                return leadingUnderscoreText + changeCase.snakeCase(text);
        }
    }

    export function isCorrectFormat(format: Format, text: string, leadingUnderscore?: boolean): boolean {
        return changeFormat(format, text, leadingUnderscore) === text;
    }
}

namespace Helpers {
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
        node: Helpers.DeclarationWithHeritageClauses | undefined,
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
    public static failureStringFactory(name: string, neededCase: string): string {
        return `Declaration "${name}" format is not correct (${neededCase}).`;
    }

    public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
        return this.applyWithWalker(new ClassMembersWalker(sourceFile, this.getOptions(), program));
    }
}

type Dictionary<TValue = any> = { [key: string]: TValue };

// The walker takes care of all the work.
class ClassMembersWalker extends Lint.ProgramAwareRuleWalker {
    //#region Helping functions
    private get ruleOptions(): Option[] {
        return this.getOptions()[0] || [];
    }

    private getRuleOption(option: Partial<Option> & Dictionary): Option | undefined {
        const options: Array<Option & Dictionary> = this.ruleOptions;

        const index = options.findIndex(x => {
            for (const key in option) {
                if (option.hasOwnProperty(key) && option[key] === x[key]) {
                    return true;
                }
            }
            return false;
        });

        return options[index];
    }

    private checkNameNode(option: Option, node: ts.Node): void {
        const format = option.format || Format.None;
        const name = node.getText();
        const casedName = FormatHelpers.changeFormat(format, name, option.leadingUnderscore);

        if (casedName !== name) {
            // create a fixer for this failure
            const fix = new Lint.Replacement(node.getStart(), node.getWidth(), casedName);

            // create a failure at the current position
            this.addFailure(this.createFailure(node.getStart(), node.getWidth(), Rule.failureStringFactory(name, format), fix));
        }
    }
    //#endregion

    public visitMethodSignature(node: ts.MethodSignature): void {
        this.checkMethod(node, node.name, MemberKind.Method);
    }

    public visitMethodDeclaration(node: ts.MethodDeclaration): void {
        this.checkMethod(node, node.name, MemberKind.Method);
    }

    private checkMethod(node: ts.Declaration, name: ts.Node, kind: MemberKind): void {
        const searchOption: Partial<Option> = {
            kind: kind,
            modifier: Helpers.resolveAccessModifierFromModifiers(node.modifiers),
            isStatic: Helpers.modifierKindExistsInModifiers(node.modifiers, ts.SyntaxKind.StaticKeyword)
        };

        const option = this.getRuleOption(searchOption);
        if (option == null) {
            return;
        }

        if (node.parent == null || !Helpers.isDeclarationWithHeritageClauses(node.parent)) {
            return;
        }

        if (
            !Helpers.checkMemberNameInHeritageDeclarations(
                this.getProgram().getTypeChecker(),
                node.parent as Helpers.DeclarationWithHeritageClauses,
                name.getText()
            )
        ) {
            this.checkNameNode(option, name);
        }
    }
}
