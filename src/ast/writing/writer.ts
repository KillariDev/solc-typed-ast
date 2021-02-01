import { ASTNode, ASTNodeConstructor } from "../ast_node";
import { Statement } from "../implementation/statement";
import { YulNode } from "../implementation/statement/inline_assembly";
import { SourceFormatter } from "./formatter";

export interface YulNodeWriter {
    write(node: YulNode, writer: YulWriter): string;
}

export type SrcRangeMap = Map<ASTNode, [number, number]>;
export type WriteManyArgs = Array<string | ASTNode | undefined>;
export type SrcDesc = Array<string | [ASTNode, any[]]>;

export interface ASTNodeWriter {
    write(node: ASTNode, writer: ASTWriter, cache: SrcRangeMap): string;
}

export class YulWriter {
    mapping: Map<string, YulNodeWriter>;
    formatter: SourceFormatter;

    constructor(mapping: Map<string, YulNodeWriter>, formatter: SourceFormatter) {
        this.mapping = mapping;
        this.formatter = formatter;
    }

    write(node: YulNode): string {
        const writer = this.mapping.get(node.nodeType);

        if (writer) {
            return writer.write(node, this);
        }

        const data = JSON.stringify(node, undefined, 4);

        throw new Error("Unable to find writer for Yul node: " + data);
    }
}

export class ASTWriter {
    mapping: Map<ASTNodeConstructor<ASTNode>, ASTNodeWriter>;
    formatter: SourceFormatter;
    targetCompilerVersion: string;

    constructor(
        mapping: Map<ASTNodeConstructor<ASTNode>, ASTNodeWriter>,
        formatter: SourceFormatter,
        targetCompilerVersion: string
    ) {
        this.mapping = mapping;
        this.formatter = formatter;
        this.targetCompilerVersion = targetCompilerVersion;
    }

    write(node: ASTNode, fragments = new Map<ASTNode, [number, number]>()): string {
        const writer = this.mapping.get(node.constructor as ASTNodeConstructor<ASTNode>);

        if (writer) {
            return writer.write(node, this, fragments);
        }

        if (node instanceof ASTNode) {
            throw new Error("Unable to find writer for AST node: " + node.print());
        }

        const data = JSON.stringify(node, undefined, 4);

        throw new Error("Expected an instance of ASTNode but got following: " + data);
    }

    desc(node: ASTNode): SrcDesc {
        const writer = this.mapping.get(node.constructor as ASTNodeConstructor<ASTNode>);

        if (writer) {
            return writer.write(node, this, fragments);
        }

        if (node instanceof ASTNode) {
            throw new Error("Unable to find writer for AST node: " + node.print());
        }

        const data = JSON.stringify(node, undefined, 4);

        throw new Error("Expected an instance of ASTNode but got following: " + data);
    }

    writeMany(srcM: SrcRangeMap, ...args: Array<string | ASTNode | undefined | null>): string {
        let res = "";
        for (const arg of args) {
            if (arg === null || arg === undefined) {
                // nothing to do...
            } else if (typeof arg === "string") {
                res += arg;
            } else {
                const nodeStr = this.write(arg, srcM);
                const nodeOff = res.length;
                const nodeLen = nodeStr.length;
                srcM.set(arg, [nodeOff, nodeLen]);
                res += nodeStr;
            }
        }
        return res;
    }
}

export class ASTSourceMapComputer {
    private getSourceFragment(node: ASTNode, fragments: Map<ASTNode, string>): string {
        const source = fragments.get(node);

        if (source === undefined) {
            /**
             * @todo This happens for a few nodes that are present in ast by default.
             *       The example would be a PararamterList node for a function with no returns.
             *       They can not be written, so the result is empty string.
             *       Better to clarify how we can handle such situations.
             */
            return "";
        }

        return source;
    }

    private getPrecomputedCoords(
        node: ASTNode,
        computed: Map<ASTNode, [number, number]>
    ): [number, number] {
        const coordinates = computed.get(node);

        if (coordinates === undefined) {
            throw new Error("Missing precomputed coordinates for the node " + node.print());
        }

        return coordinates;
    }

    private computeNodeCoords(
        node: ASTNode,
        fragments: Map<ASTNode, string>,
        computed: Map<ASTNode, [number, number]>
    ): [number, number] {
        const parent = node.parent;
        const sourceN = this.getSourceFragment(node, fragments);
        const lenN =
            node instanceof Statement && sourceN.endsWith(";")
                ? sourceN.length - 1
                : sourceN.length;

        /**
         * If there is no parent, then it is a root.
         */
        if (parent === undefined) {
            return [0, lenN];
        }

        const sourceP = this.getSourceFragment(parent, fragments);
        const [startP] = this.getPrecomputedCoords(parent, computed);

        let offset = 0;

        const sibling = node.previousSibling;

        /**
         * If there is a previous sibling, then shift searching offset
         * to start looking just after the end of the previous sibling node.
         * Then we will not have collisions for the equal code segments.
         */
        if (sibling) {
            const [startS, lenS] = this.getPrecomputedCoords(sibling, computed);

            offset = startS + lenS - startP;
        }

        const startN = startP + sourceP.indexOf(sourceN, offset);

        return [startN, lenN];
    }

    compute(node: ASTNode, fragments: Map<ASTNode, string>): Map<ASTNode, [number, number]> {
        const result = new Map<ASTNode, [number, number]>();

        node.walk((target) => {
            result.set(target, this.computeNodeCoords(target, fragments, result));
        });

        return result;
    }
}
