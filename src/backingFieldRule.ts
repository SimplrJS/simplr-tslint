import * as ts from "typescript";
import * as Lint from "tslint";
import * as changeCase from "change-case";

const BACKING_FIELD_PREFIX = "_";

export class Rule extends Lint.Rules.AbstractRule {
    public static readonly failureMessage: string = "Backing field can only be used in GetAccessor and SetAccessor.";

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new BackingFieldsWalker(sourceFile, this.getOptions()));
    }
}

class BackingFieldsWalker extends Lint.RuleWalker {
    private checkPropertyPrefix(name: string): boolean {
        return name === BACKING_FIELD_PREFIX + changeCase.camelCase(name);
    }

    private isMemberOfClassDeclaration(classDeclaration: ts.ClassDeclaration, name: string): boolean {
        for (const member of classDeclaration.members) {
            // Property
            if (
                ts.isPropertyDeclaration(member) &&
                member.modifiers != null &&
                member.modifiers.findIndex(x => x.kind === ts.SyntaxKind.PrivateKeyword) &&
                member.name.getText() === name
            ) {
                return true;
            }

            // Constructor Parameter Property.
            if (ts.isConstructorDeclaration(member)) {
                for (const parameter of member.parameters) {
                    if (
                        parameter.modifiers != null &&
                        parameter.modifiers.findIndex(x => x.kind === ts.SyntaxKind.PrivateKeyword) &&
                        parameter.name.getText() === name
                    ) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    public visitPropertyAccessExpression(node: ts.PropertyAccessExpression): void {
        super.visitPropertyAccessExpression(node);
        const name = node.name.getText();

        if (!this.checkPropertyPrefix(name)) {
            return;
        }

        let currentParentNode: ts.Node | undefined = node.parent;
        let classDeclaration: ts.ClassDeclaration | undefined;
        while (currentParentNode != null) {
            if (ts.isGetAccessorDeclaration(currentParentNode) || ts.isSetAccessorDeclaration(currentParentNode)) {
                return;
            }

            if (ts.isClassDeclaration(currentParentNode)) {
                classDeclaration = currentParentNode;
            }

            currentParentNode = currentParentNode.parent;
        }

        // Backing field can only be used in GetAccessor and SetAccessor declarations.
        if (classDeclaration != null && this.isMemberOfClassDeclaration(classDeclaration, name)) {
            this.addFailureAtNode(node, Rule.failureMessage);
        }
    }
}
