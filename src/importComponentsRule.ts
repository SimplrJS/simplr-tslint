import * as path from "path";
import * as ts from "typescript";
import * as Lint from "tslint";
import * as fs from "fs";

interface PathDetails {
    prefix: string;
    suffix: string;
    moduleName: string;
    fullModuleName: string;
    fileName: string;
    splitPath: string[];
    withQuotes: boolean;
}

export class Rule extends Lint.Rules.AbstractRule {
    public static readonly sep: string = "/";

    public static readonly searchModulePath: string = ["app", "components"].join(Rule.sep);
    public static readonly searchModulePathSplitter: string = Rule.searchModulePath + Rule.sep;

    public static readonly entryFailureString: string = "Components should be imported from an entry file.";
    public static readonly insideRelativeFailureString: string = "A relative import should be used inside the components.";
    public static readonly insideEntryFailureString: string = "An entry file import should not be used inside the components.";
    public static readonly forbiddenReexportAllFailureString: string = "Forbidden 'export * from', use named re-exports.";

    public static readonly moduleFilenameSuffix: string = "-components";

    public static readonly reexportPathRegex: RegExp = /export[\s\S]*from[\s]*[\'\"](.*)[\'\"]/;
    public static readonly reexportAllPathRegex: RegExp = /export[\s\S]*\*/;

    public static resolveModuleFilename(moduleName: string): string {
        return moduleName + this.moduleFilenameSuffix;
    }

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ImportModuleWalker(sourceFile, this.getOptions()));
    }

    private static componentsEntryFilesCache: { [fileName: string]: boolean } = {};

    public static getComponentEntryFileFromCache(fileName: string): undefined | boolean {
        return this.componentsEntryFilesCache[fileName];
    }

    public static setComponentEntryFileToCache(fileName: string, value: boolean): void {
        this.componentsEntryFilesCache[fileName] = value;
    }
}

class ImportModuleWalker extends Lint.RuleWalker {
    /**
     * Update import path with module entry file.
     */
    private importEntryFileFixer(
        start: number,
        length: number,
        prefix: string,
        moduleName: string,
        fullModuleName: string,
        quoteSymbol: string
    ): Lint.Replacement {

        const resolvedImport = [
            prefix + Rule.searchModulePath,
            moduleName,
            fullModuleName + quoteSymbol
        ].join(Rule.sep);

        return new Lint.Replacement(start, length, resolvedImport);
    }

    /**
     * Change path to relative.
     */
    private importWithRelativePathFixer(
        start: number,
        length: number,
        importFileName: string,
        sourceSplitPath: string[],
        importSplitPath: string[],
        quoteSymbol: string
    ): Lint.Replacement {

        const sourcePath = sourceSplitPath.slice(0, -1).join(Rule.sep);
        const importPath = importSplitPath.slice(0, -1).join(Rule.sep);

        const relativePath = path.relative(sourcePath, importPath).split(path.sep);
        relativePath.push(importFileName);

        let relativePathString = relativePath.join(Rule.sep);

        if (relativePathString[0] === Rule.sep) {
            relativePathString = "." + relativePathString;
        } else if (relativePathString[0] !== ".") {
            relativePathString = `.${Rule.sep}${relativePathString}`;
        }

        const fixedPath = `${quoteSymbol}${relativePathString}${quoteSymbol}`;

        return new Lint.Replacement(start, length, fixedPath);
    }

    /**
     * Generate path details object from pathname.
     */
    private parsePathDetails(pathname: string, withQuotes: boolean = true): PathDetails {
        const [prefix, suffix] = pathname.split(Rule.searchModulePathSplitter);
        const [moduleName, ...importSplitPath] = suffix.split(Rule.sep);

        if (withQuotes) {
            importSplitPath[importSplitPath.length - 1] = importSplitPath[importSplitPath.length - 1].slice(0, -1);
        }

        const [fileName] = importSplitPath.slice(-1);

        return {
            prefix: prefix,
            suffix: suffix,
            moduleName: moduleName,
            fullModuleName: Rule.resolveModuleFilename(moduleName),
            splitPath: importSplitPath,
            fileName: fileName,
            withQuotes: withQuotes
        };
    }

    /**
     * Validate import line.
     */
    private startValidating(sourceFile: string, importFile: string, importStart: number, quote: string = ""): void {
        const sourceFileIsFromModule = sourceFile.indexOf(Rule.searchModulePath) > -1;
        const importFileIsFromModule = importFile.indexOf(Rule.searchModulePath) > -1;

        if (!sourceFileIsFromModule && !importFileIsFromModule) {
            return;
        }

        // Check if importing file is not from module
        if (!importFileIsFromModule) {

            // Check if source file is from module
            if (sourceFileIsFromModule) {
                const sourceDetails = this.parsePathDetails(sourceFile, false);
                const importFileName = importFile.split(Rule.sep).slice(-1)[0].slice(0, -1);
                const targetFileName = sourceDetails.fullModuleName;

                // Check if module itself doesn't import from entry file
                if (importFileName === targetFileName) {
                    this.addFailureAt(importStart, importFile.length, Rule.insideEntryFailureString);
                }
            }
            return;
        }

        const importDetails = this.parsePathDetails(importFile, Boolean(quote));
        if (sourceFileIsFromModule && importFileIsFromModule) {
            const sourceDetails = this.parsePathDetails(sourceFile, false);
            if (sourceDetails.moduleName === importDetails.moduleName) {
                const fix = this.importWithRelativePathFixer(
                    importStart,
                    importFile.length,
                    importDetails.fileName,
                    sourceDetails.splitPath,
                    importDetails.splitPath,
                    quote
                );
                this.addFailureAt(importStart, importFile.length, Rule.insideRelativeFailureString, fix);
                return;
            }
        }

        if (importFileIsFromModule && (importDetails.splitPath.length > 1 || importDetails.fullModuleName !== importDetails.fileName)) {
            const fromCache = Rule.getComponentEntryFileFromCache(importDetails.fullModuleName);
            let isComponentsWithEntry: boolean;
            if (fromCache == null) {
                isComponentsWithEntry = fs.existsSync(importDetails.fullModuleName);
                Rule.setComponentEntryFileToCache(importDetails.fullModuleName, isComponentsWithEntry);
            } else {
                isComponentsWithEntry = fromCache;
            }

            if (isComponentsWithEntry) {
                const fix = this.importEntryFileFixer(
                    importStart,
                    importFile.length,
                    importDetails.prefix,
                    importDetails.moduleName,
                    importDetails.fullModuleName,
                    quote
                );
                this.addFailureAt(importStart, importFile.length, Rule.entryFailureString, fix);
            }
            return;
        }
    }

    private startValidatingReExportAll(fullText: string, sourceFile: string, node: ts.Statement): void {
        const sourceFileIsFromModule = sourceFile.indexOf(Rule.searchModulePath) > -1;
        if (sourceFileIsFromModule && Rule.reexportAllPathRegex.test(fullText)) {
            this.addFailureAtNode(node, Rule.forbiddenReexportAllFailureString);
        }
    }

    /**
     * Visit on import declaration found.
     */
    public visitImportDeclaration(node: ts.ImportDeclaration): void {
        const sourceFile = node.getSourceFile().fileName;
        const importFile = node.moduleSpecifier.getText();
        const importStart = node.moduleSpecifier.getStart();
        const quoteSymbol = importFile[0];

        this.startValidating(sourceFile, importFile, importStart, quoteSymbol);

        super.visitImportDeclaration(node);
    }

    /**
     * Visit on any source file.
     */
    public visitSourceFile(node: ts.SourceFile): void {
        const fullText = node.getFullText();
        const sourceFile = node.fileName;

        if (node.statements.length > 0) {
            node.statements
                .filter(x => x.kind === ts.SyntaxKind.ExportDeclaration && x.getFullText().indexOf("from") > -1)
                .forEach(statement => {
                    const text = statement.getFullText();

                    const regexResult = Rule.reexportPathRegex.exec(text);
                    if (regexResult == null) {
                        return;
                    }

                    const importFile = regexResult[1];
                    if (importFile == null) {
                        return;
                    }

                    this.startValidatingReExportAll(text, sourceFile, statement);

                    const importStart = fullText.indexOf(importFile);
                    this.startValidating(sourceFile, importFile, importStart);
                });
        }

        super.visitSourceFile(node);
    }
}
