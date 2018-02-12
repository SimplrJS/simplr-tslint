import * as ts from "typescript";
import * as Lint from "tslint";
import * as changeCase from "change-case";

export class Rule extends Lint.Rules.AbstractRule {
    public static readonly failureString: string = "TODO: Add failure string _____";

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new NoImportsWalker(sourceFile, this.getOptions()));
    }
}

class NoImportsWalker extends Lint.RuleWalker {
    private isNodeInModuleDeclaration(node: ts.Node): boolean {
        return ts.isModuleBlock(node) && node.parent != null && ts.isModuleDeclaration(node.parent);
    }

    public visitVariableStatement(node: ts.VariableStatement): void {
        super.visitVariableStatement(node);
        if (node.parent == null || (!ts.isSourceFile(node.parent) && !this.isNodeInModuleDeclaration(node.parent))) {
            return;
        }

        const variableDeclarationList = node.declarationList.declarations;

        for (const variableDeclaration of variableDeclarationList) {
            const name = variableDeclaration.name.getText();
            const casedName = changeCase.constantCase(name);

            if (name !== casedName) {
                const nodeNameStart = variableDeclaration.name.getStart();
                const nodeNameEnd = variableDeclaration.name.getWidth();

                const fix = new Lint.Replacement(nodeNameStart, nodeNameEnd, casedName);
                this.addFailure(this.createFailure(nodeNameStart, nodeNameEnd, Rule.failureString, fix));
            }
        }
    }
}
