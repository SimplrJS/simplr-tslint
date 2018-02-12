import * as ts from "typescript";
import * as Lint from "tslint";
import * as changeCase from "change-case";

const PREFIX = "T";

function isUpperCase(str: string): boolean {
    return str === str.toUpperCase();
}

function hasPrefix(name: string): boolean {
    return name.length >= 2 && name[0] === PREFIX && isUpperCase(name[1]);
}

export class Rule extends Lint.Rules.AbstractRule {
    public static readonly failureString: string = "TODO: Add failure string _____";

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk);
    }
}

function walk(ctx: Lint.WalkContext<void>): void {
    const cb = (node: ts.Node): void => {
        if (ts.isTypeParameterDeclaration(node)) {
            const name = node.name.getText();

            if (!hasPrefix(name)) {
                const casedName = PREFIX + changeCase.pascalCase(name);
                const fix = new Lint.Replacement(node.getStart(), node.getWidth(), casedName);

                ctx.addFailureAtNode(node, Rule.failureString, fix);
            }
        }

        return ts.forEachChild(node, cb);
    };

    return ts.forEachChild(ctx.sourceFile, cb);
}
