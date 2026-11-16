package io.github.alejandrolunatech.arktschecker.core

import java.time.Duration

/** What one run of the checker on one file gave. */
sealed interface CheckOutcome {
    /** The checker ran and answered. An empty list means the file is clean. */
    data class Checked(val findings: List<Finding>) : CheckOutcome

    /** The checker did not answer. [reason] is a sentence for the user. */
    data class Failed(val reason: String) : CheckOutcome
}

/** A check takes about two seconds. Ten times that means something is wrong. */
val CHECK_TIMEOUT: Duration = Duration.ofSeconds(20)

private const val STDERR_SHOWN_CHARS = 600

/**
 * Checks [text] as if it were the file [fileName], without touching the file on disk.
 * Blocks for about two seconds; see [runProcess] for threads and cancellation.
 */
fun runChecker(
    setup: CheckerSetup.Ready,
    fileName: String,
    text: String,
    timeout: Duration = CHECK_TIMEOUT,
    checkCancelled: () -> Unit = {},
): CheckOutcome {
    val result = runProcess(setup.commandFor(fileName), setup.labDirectory, text, timeout, checkCancelled)
    return interpret(result, timeout)
}

/**
 * Decides what a finished process means.
 *
 * The exit code is not used for the decision. The checker exits with 1 when it finds errors,
 * and that is a successful check. What counts is whether standard output holds the JSON:
 * on a usage problem the checker prints nothing there and explains itself on standard error.
 */
fun interpret(result: ProcessResult, timeout: Duration = CHECK_TIMEOUT): CheckOutcome = when (result) {
    is ProcessResult.NotStarted ->
        CheckOutcome.Failed("The checker could not be started: ${result.reason}")

    ProcessResult.TimedOut ->
        CheckOutcome.Failed("The checker did not finish within ${timeout.toSeconds()} seconds and was stopped.")

    is ProcessResult.Exited ->
        try {
            CheckOutcome.Checked(parseFindings(result.stdout))
        } catch (e: CheckerOutputException) {
            val said = result.stderr.trim().take(STDERR_SHOWN_CHARS)
            val detail = if (said.isEmpty()) "" else " It said: $said"
            CheckOutcome.Failed("The checker gave no result: ${e.message} (exit code ${result.exitCode}).$detail")
        }
}
