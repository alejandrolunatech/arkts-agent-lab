package io.github.alejandrolunatech.arktschecker.core

import java.nio.file.Files
import java.nio.file.InvalidPathException
import java.nio.file.Path

/** The entry file of `tsx`, the tool the lab uses to run TypeScript, relative to the lab checkout. */
const val TSX_ENTRY = "node_modules/tsx/dist/cli.mjs"

/** The lab's command line program, relative to the lab checkout. */
const val LAB_CLI = "src/cli.ts"

fun isArkTsFileName(name: String): Boolean = name.endsWith(".ets", ignoreCase = true)

/** The two configured paths, either usable or not. */
sealed interface CheckerSetup {

    /** Both paths point at what they should. Only this state can build a command line. */
    data class Ready(val labDirectory: Path, val node: Path) : CheckerSetup {

        /**
         * The command that checks one file given on standard input:
         * `node <lab>/node_modules/tsx/dist/cli.mjs <lab>/src/cli.ts check --stdin --json --filename <name>`.
         *
         * It starts `node` directly and never goes through `npm run`, which prints a banner on
         * standard output, in front of the JSON. Each argument is its own list element, so a
         * path with spaces needs no quoting and nothing is ever interpreted by a shell.
         */
        fun commandFor(fileName: String): List<String> = listOf(
            node.toString(),
            labDirectory.resolve(TSX_ENTRY).toString(),
            labDirectory.resolve(LAB_CLI).toString(),
            "check",
            "--stdin",
            "--json",
            "--filename",
            fileName,
        )
    }

    /** Something is missing. [message] says what, in words a user can act on. */
    data class Problem(val message: String) : CheckerSetup
}

/**
 * Looks at the two paths from the settings and says whether the checker can be started.
 *
 * It only asks whether files exist. It reads none of them.
 */
fun resolveSetup(labDirectory: String, nodePath: String): CheckerSetup {
    if (labDirectory.isBlank()) return problem("The path to the arkts-agent-lab checkout is not set.")
    if (nodePath.isBlank()) return problem("The path to the node executable is not set.")

    val lab = toPath(labDirectory) ?: return problem("The lab checkout path is not a valid path: $labDirectory")
    val node = toPath(nodePath) ?: return problem("The node path is not a valid path: $nodePath")

    if (!Files.isDirectory(lab)) return problem("The lab checkout is not a directory: $lab")
    if (!Files.isRegularFile(lab.resolve(LAB_CLI))) {
        return problem("This is not an arkts-agent-lab checkout ($LAB_CLI is missing): $lab")
    }
    if (!Files.isRegularFile(lab.resolve(TSX_ENTRY))) {
        return problem("The lab's dependencies are not installed ($TSX_ENTRY is missing). Run \"npm ci\" in $lab")
    }
    if (!Files.isRegularFile(node) || !Files.isExecutable(node)) {
        return problem("The node path is not an executable file: $node")
    }
    return CheckerSetup.Ready(lab, node)
}

private fun problem(message: String) = CheckerSetup.Problem(message)

private fun toPath(text: String): Path? =
    try {
        Path.of(text.trim()).toAbsolutePath()
    } catch (e: InvalidPathException) {
        null
    }
