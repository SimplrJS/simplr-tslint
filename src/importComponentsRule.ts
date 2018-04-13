import * as path from "path";
import * as ts from "typescript";
import * as Lint from "tslint";
import * as fs from "fs";

interface PathDetails {
    Prefix: string;
    Suffix: string;
    ModuleName: string;
    FullModuleName: string;
    FileName: string;
    splitPath: string[];
    withQuotes: boolean;
}

export class Rule extends Lint.Rules.AbstractRule {
    public static readonly SEP: string = "/";

    public static readonly SEARCH_MODULE_PATH: string = ["app", "components"].join(Rule.SEP);
    public static readonly SEARCH_MODULE_PATH_SPLITTER: string = Rule.SEARCH_MODULE_PATH + Rule.SEP;

    public static readonly ENTRY_FAILURE_STRING: string = "Components should be imported from an entry file.";
    public static readonly INSIDE_RELATIVE_FAILURE_STRING: string = "A relative import should be used inside the components.";
    public static readonly INSIDE_ENTRY_FAILURE_STRING: string = "An entry file import should not be used inside the components.";
    public static readonly FORBIDDEN_REEXPORT_ALL_FAILURE_STRING: string = "Forbidden 'export * from', use named re-exports.";

    public static readonly MODULE_FILENAME_SUFFIX: string = "-components";

    public static readonly REEXPORT_PATH_REGEX: RegExp = /export[\s\S]*from[\s]*[\'\"](.*)[\'\"]/;
    public static readonly REEXPORT_ALL_PATH_REGEX: RegExp = /export[\s\S]*\*/;

    public static RESOLVE_MODULE_FILENAME(moduleName: string): string {
        return moduleName + this.MODULE_FILENAME_SUFFIX;
    }

    public apply(sourceFile: ts.SourceFile): Lint.RuleFailure[] {
        return this.applyWithWalker(new ImportModuleWalker(sourceFile, this.getOptions()));
    }

    private static componentsEntryFilesCache: { [fileName: string]: boolean } = {};

    public static GetComponentEntryFileFromCache(fileName: string): undefined | boolean {
        return this.componentsEntryFilesCache[fileName];
    }

    public static SetComponentEntryFileToCache(fileName: string, value: boolean): void {
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
            prefix + Rule.SEARCH_MODULE_PATH,
            moduleName,
            fullModuleName + quoteSymbol
        ].join(Rule.SEP);

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

        const sourcePath = sourceSplitPath.slice(0, -1).join(Rule.SEP);
        const importPath = importSplitPath.slice(0, -1).join(Rule.SEP);

        const relativePath = path.relative(sourcePath, importPath).split(path.sep);
        relativePath.push(importFileName);

        let relativePathString = relativePath.join(Rule.SEP);

        if (relativePathString[0] === Rule.SEP) {
            relativePathString = "." + relativePathString;
        } else if (relativePathString[0] !== ".") {
            relativePathString = `.${Rule.SEP}${relativePathString}`;
        }

        const fixedPath = `${quoteSymbol}${relativePathString}${quoteSymbol}`;

        return new Lint.Replacement(start, length, fixedPath);
    }

    /**
     * Generate path details object from pathname.
     */
    private parsePathDetails(pathname: string, withQuotes: boolean = true): PathDetails {
        const [prefix, suffix] = pathname.split(Rule.SEARCH_MODULE_PATH_SPLITTER);
        const [moduleName, ...importSplitPath] = suffix.split(Rule.SEP);

        if (withQuotes) {
            importSplitPath[importSplitPath.length - 1] = importSplitPath[importSplitPath.length - 1].slice(0, -1);
        }

        const [fileName] = importSplitPath.slice(-1);

        return {
            Prefix: prefix,
            Suffix: suffix,
            ModuleName: moduleName,
            FullModuleName: Rule.RESOLVE_MODULE_FILENAME(moduleName),
            splitPath: importSplitPath,
            FileName: fileName,
            withQuotes: withQuotes
        };
    }

    /**
     * Validate import line.
     */
    private startValidating(sourceFile: string, importFile: string, importStart: number, quote: string = ""): void {
        const sourceFileIsFromModule = sourceFile.indexOf(Rule.SEARCH_MODULE_PATH) > -1;
        const importFileIsFromModule = importFile.indexOf(Rule.SEARCH_MODULE_PATH) > -1;

        if (!sourceFileIsFromModule && !importFileIsFromModule) {
            return;
        }

        // Check if importing file is not from module
        if (!importFileIsFromModule) {

            // Check if source file is from module
            if (sourceFileIsFromModule) {
                const sourceDetails = this.parsePathDetails(sourceFile, false);
                const importFileName = importFile.split(Rule.SEP).slice(-1)[0].slice(0, -1);
                const targetFileName = sourceDetails.FullModuleName;

                // Check if module itself doesn't import from entry file
                if (importFileName === targetFileName) {
                    this.addFailureAt(importStart, importFile.length, Rule.INSIDE_ENTRY_FAILURE_STRING);
                }
            }
            return;
        }

        const importDetails = this.parsePathDetails(importFile, Boolean(quote));
        if (sourceFileIsFromModule && importFileIsFromModule) {
            const sourceDetails = this.parsePathDetails(sourceFile, false);
            if (sourceDetails.ModuleName === importDetails.ModuleName) {
                const fix = this.importWithRelativePathFixer(
                    importStart,
                    importFile.length,
                    importDetails.FileName,
                    sourceDetails.splitPath,
                    importDetails.splitPath,
                    quote
                );
                this.addFailureAt(importStart, importFile.length, Rule.INSIDE_RELATIVE_FAILURE_STRING, fix);
                return;
            }
        }

        if (importFileIsFromModule && (importDetails.splitPath.length > 1 || importDetails.FullModuleName !== importDetails.FileName)) {
            const fromCache = Rule.GetComponentEntryFileFromCache(importDetails.FullModuleName);
            let isComponentsWithEntry: boolean;
            if (fromCache == null) {
                isComponentsWithEntry = fs.existsSync(importDetails.FullModuleName);
                Rule.SetComponentEntryFileToCache(importDetails.FullModuleName, isComponentsWithEntry);
            } else {
                isComponentsWithEntry = fromCache;
            }

            if (isComponentsWithEntry) {
                const fix = this.importEntryFileFixer(
                    importStart,
                    importFile.length,
                    importDetails.Prefix,
                    importDetails.ModuleName,
                    importDetails.FullModuleName,
                    quote
                );
                this.addFailureAt(importStart, importFile.length, Rule.ENTRY_FAILURE_STRING, fix);
            }
            return;
        }
    }

    private startValidatingReExportAll(fullText: string, sourceFile: string, node: ts.Statement): void {
        const sourceFileIsFromModule = sourceFile.indexOf(Rule.SEARCH_MODULE_PATH) > -1;
        if (sourceFileIsFromModule && Rule.REEXPORT_ALL_PATH_REGEX.test(fullText)) {
            this.addFailureAtNode(node, Rule.FORBIDDEN_REEXPORT_ALL_FAILURE_STRING);
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

                    const regexResult = Rule.REEXPORT_PATH_REGEX.exec(text);
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
