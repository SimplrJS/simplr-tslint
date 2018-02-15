import * as ts from "typescript";
import * as Lint from "tslint";
import * as changeCase from "change-case";

export const ONLY_PRIMITIVE: string = "only-primitive";

export class Rule extends Lint.Rules.TypedRule {
    // tslint:disable-next-line:max-line-length
    public static readonly failureMessage: string = "Const variables in source file or in module declaration must have (constant-case) format.";

    public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): Lint.RuleFailure[] {
        return this.applyWithWalker(new ConstVariableWalker(sourceFile, this.getOptions(), program));
    }
}

class ConstVariableWalker extends Lint.ProgramAwareRuleWalker {
    private isNodeInModuleDeclaration(node: ts.Node): boolean {
        return ts.isModuleBlock(node) && node.parent != null && ts.isModuleDeclaration(node.parent);
    }

    private isTypePrimitive(type: ts.Type): boolean {
        const primitive =
            ts.TypeFlags.String |
            ts.TypeFlags.Number |
            ts.TypeFlags.Boolean |
            ts.TypeFlags.Enum |
            ts.TypeFlags.EnumLiteral |
            ts.TypeFlags.ESSymbol |
            ts.TypeFlags.Void |
            ts.TypeFlags.Undefined |
            ts.TypeFlags.Null |
            ts.TypeFlags.Literal |
            ts.TypeFlags.UniqueESSymbol;

        return Boolean(type.flags & primitive);
    }

    public visitVariableStatement(node: ts.VariableStatement): void {
        super.visitVariableStatement(node);
        if (node.parent == null || (!ts.isSourceFile(node.parent) && !this.isNodeInModuleDeclaration(node.parent))) {
            return;
        }

        const typeChecker = this.getTypeChecker();
        const variableDeclarationList = node.declarationList.declarations;

        for (const variableDeclaration of variableDeclarationList) {
            if (this.hasOption(ONLY_PRIMITIVE)) {
                const type = typeChecker.getTypeAtLocation(variableDeclaration);

                if (!this.isTypePrimitive(type)) {
                    continue;
                }
            }

            const name = variableDeclaration.name.getText();
            const casedName = changeCase.constantCase(name);

            if (name !== casedName) {
                const nodeNameStart = variableDeclaration.name.getStart();
                const nodeNameEnd = variableDeclaration.name.getWidth();

                const fix = new Lint.Replacement(nodeNameStart, nodeNameEnd, casedName);
                this.addFailure(this.createFailure(nodeNameStart, nodeNameEnd, Rule.failureMessage, fix));
            }
        }
    }
}
