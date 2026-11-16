package io.github.alejandrolunatech.arktschecker.core

enum class Severity { ERROR, WARNING }

/**
 * One problem the lab's checker found in a file.
 *
 * Lines and columns are 1-based. The end position is exclusive, and it can be equal to the
 * start: `'}' expected` at the end of a file has no text to point at.
 */
data class Finding(
    /** `syntax`, `type`, `arkts` or `arkui`: the layer of the checker that reported it. */
    val layer: String,
    /** `TS2322` for compiler findings, the rule name (`arkts-no-any-unknown`) for linter findings. */
    val code: String,
    val severity: Severity,
    val file: String,
    val line: Int,
    val column: Int,
    val endLine: Int,
    val endColumn: Int,
    val message: String,
) {
    /**
     * The text shown in the editor. It always names the rule: linter messages already end with
     * the rule name, compiler messages get their `TS` code in front.
     */
    val displayMessage: String
        get() = if (message.contains(code)) message else "$code: $message"

    /** One line in the format the lab prints, which is also what its evaluation loop shows a model. */
    fun toFeedbackLine(): String =
        "$file:$line:$column ${severity.name.lowercase()} [$code] $message"
}

/** All findings as text: one per line, then how many of them are errors. */
fun formatFeedback(findings: List<Finding>): String {
    val errors = findings.count { it.severity == Severity.ERROR }
    val summary = if (errors == 0) "No errors." else "$errors error(s)."
    return (findings.map { it.toFeedbackLine() } + summary).joinToString("\n")
}
