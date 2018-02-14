import * as ts from "typescript";
import * as Lint from "tslint";

export class Rule extends Lint.Rules.AbstractRule {
    public static readonly failureMessage: string = "All module members must be exported.";

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ExportedNamespaceMembersWalker(sourceFile, this.getOptions()));
    }
}

class ExportedNamespaceMembersWalker extends Lint.RuleWalker {
    public visitModuleDeclaration(node: ts.ModuleDeclaration): void {
        super.visitModuleDeclaration(node);
        if (node.body == null || !ts.isModuleBlock(node.body)) {
            return;
        }

        for (const statement of node.body.statements) {
            if (statement.modifiers == null || statement.modifiers.findIndex(x => x.kind === ts.SyntaxKind.ExportKeyword) === -1) {
                const fix = new Lint.Replacement(statement.getStart(), 0, "export ");
                this.addFailureAtNode(statement, Rule.failureMessage, fix);
            }
        }
    }
}
