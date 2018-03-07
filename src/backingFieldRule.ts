import * as ts from "typescript";
import * as Lint from "tslint";
import * as changeCase from "change-case";

const BACKING_FIELD_PREFIX = "_";

export class Rule extends Lint.Rules.AbstractRule {
    public static readonly usageFailureMessage: string = "Backing field can only be used in GetAccessor and SetAccessor.";
    public static accessorFailureMessageFactory(expectedName: string): string {
        return `Accessor expected name "${expectedName}".`;
    }

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new BackingFieldsWalker(sourceFile, this.getOptions()));
    }
}

class BackingFieldsWalker extends Lint.RuleWalker {
    private checkPropertyPrefix(name: string): boolean {
        return name === BACKING_FIELD_PREFIX + changeCase.camelCase(name);
    }

    private removePrefix(name: string): string {
        return name.substring(BACKING_FIELD_PREFIX.length, name.length);
    }

    private checkAccessorName(accessorName: string, backingFieldName: string): boolean {
        return BACKING_FIELD_PREFIX + accessorName === backingFieldName;
    }

    private isMemberOfClassDeclaration(classDeclaration: ts.ClassDeclaration, name: string): boolean {
        for (const member of classDeclaration.members) {
            // Property
            if (
                ts.isPropertyDeclaration(member) &&
                member.modifiers != null &&
                member.modifiers.findIndex(x => x.kind === ts.SyntaxKind.PrivateKeyword) !== -1 &&
                member.name.getText() === name
            ) {
                return true;
            }

            // Constructor Parameter Property.
            if (ts.isConstructorDeclaration(member)) {
                for (const parameter of member.parameters) {
                    if (
                        parameter.modifiers != null &&
                        parameter.modifiers.findIndex(x => x.kind === ts.SyntaxKind.PrivateKeyword) !== -1 &&
                        parameter.name.getText() === name
                    ) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    public visitSourceFile(node: ts.SourceFile): void {
        // This rule should only work in source files.
        if (!node.isDeclarationFile) {
            super.visitSourceFile(node);
        }
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
                const accessorNameNode = currentParentNode.name;
                const casedAccessorName = changeCase.camelCase(accessorNameNode.getText());

                if (!this.checkAccessorName(casedAccessorName, name)) {
                    const expectedAccessorName = this.removePrefix(name);
                    const accessorNameNodeStart = accessorNameNode.getStart();
                    const accessorNameNodeWidth = accessorNameNode.getWidth();
                    const fix = new Lint.Replacement(accessorNameNodeStart, accessorNameNodeWidth, expectedAccessorName);

                    this.addFailureAt(
                        accessorNameNodeStart,
                        accessorNameNodeWidth,
                        Rule.accessorFailureMessageFactory(expectedAccessorName),
                        fix
                    );
                }

                return;
            }

            if (ts.isClassDeclaration(currentParentNode)) {
                classDeclaration = currentParentNode;
            }

            currentParentNode = currentParentNode.parent;
        }

        // Backing field can only be used in GetAccessor and SetAccessor declarations.
        if (classDeclaration != null && this.isMemberOfClassDeclaration(classDeclaration, name)) {
            this.addFailureAtNode(node, Rule.usageFailureMessage);
        }
    }
}
