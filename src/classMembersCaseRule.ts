import * as ts from "typescript";
import * as Lint from "tslint";
import * as changeCase from "change-case";

type DeclarationWithHeritageClauses = ts.Declaration & { heritageClauses?: ts.NodeArray<ts.HeritageClause> };

export class Rule extends Lint.Rules.TypedRule {
    // FIXME: Remove this next line.
    // tslint:disable-next-line:class-members-case
    public static FAILURE_STRING_FACTORY(name: string, neededCase: string): string {
        return `Declaration "${name}" format is not correct (${neededCase}).`;
    }

    public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
        return this.applyWithWalker(new ClassMembersWalker(sourceFile, this.getOptions(), program));
    }
}

// The walker takes care of all the work.
class ClassMembersWalker extends Lint.ProgramAwareRuleWalker {
    public walk(sourceFile: ts.SourceFile): void {
        const cb = (node: ts.Node): void => {
            if (ts.isMethodDeclaration(node)) {
                const found = this.checkMemberNameInHeritageDeclarations(
                    node.parent as DeclarationWithHeritageClauses,
                    node.name.getText()
                );

                if (!found) {
                    this.checkNameNode(node.name);
                }
            } else {
                // Continue rescursion: call function `cb` for all children of the current node.
                return ts.forEachChild(node, cb);
            }
        };

        // Start recursion for all children of `sourceFile`.
        return ts.forEachChild(sourceFile, cb);
    }

    /**
     * Checks all heritage list to find specific given name. If it doesn't exist, it returns false.
     * @param node Node with heritage list.
     * @param targetName Name to search for in heritage list.
     */
    private checkMemberNameInHeritageDeclarations(node: DeclarationWithHeritageClauses, targetName: string): boolean {
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
                const type = this.getTypeChecker().getTypeFromTypeNode(typeNode);
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
                            return this.checkMemberNameInHeritageDeclarations(declaration, targetName);
                        }
                    }
                }
            }
        }

        return false;
    }

    private checkNameNode(node: ts.Node): void {
        const name = node.getText();
        const casedName = changeCase.camelCase(name);
        if (casedName !== name) {
            // create a fixer for this failure
            const fix = new Lint.Replacement(node.getStart(), node.getWidth(), casedName);

            // create a failure at the current position
            this.addFailure(this.createFailure(node.getStart(), node.getWidth(), Rule.FAILURE_STRING_FACTORY(name, "camelCase"), fix));
        }
    }
}
