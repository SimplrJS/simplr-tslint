import * as ts from "typescript";
import * as Lint from "tslint";

const BACKING_FIELD_PREFIX = "_";

export class Rule extends Lint.Rules.AbstractRule {
    public static readonly failureMessage: string = "Backing field can only be used in GetAccessor and SetAccessor.";

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new BackingFieldsWalker(sourceFile, this.getOptions()));
    }
}

class BackingFieldsWalker extends Lint.RuleWalker {
    private checkPropertyPrefix(name: string): boolean {
        return name.substring(0, BACKING_FIELD_PREFIX.length) === BACKING_FIELD_PREFIX;
    }

    private isNodeInAccessors(node: ts.Node): boolean {
        let currentParentNode: ts.Node | undefined = node.parent;
        while (currentParentNode != null) {
            if (ts.isGetAccessorDeclaration(currentParentNode) || ts.isSetAccessorDeclaration(currentParentNode)) {
                return true;
            }
            if (ts.isClassDeclaration(currentParentNode)) {
                return false;
            }

            currentParentNode = currentParentNode.parent;
        }

        return false;
    }

    public visitPropertyAccessExpression(node: ts.PropertyAccessExpression): void {
        super.visitPropertyAccessExpression(node);
        const name = node.name.getText();

        if (!this.checkPropertyPrefix(name)) {
            return;
        }

        // Backing field can only be used in GetAccessor and SetAccessor declarations.
        if (!this.isNodeInAccessors(node)) {
            this.addFailureAtNode(node, Rule.failureMessage);
        }
    }
}
