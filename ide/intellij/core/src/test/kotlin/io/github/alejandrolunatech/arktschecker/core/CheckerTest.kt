package io.github.alejandrolunatech.arktschecker.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import java.time.Duration

/** What a finished process means. No process is started here. */
class CheckerTest {

    private val oneFinding =
        """{"findings":[{"layer":"type","code":"TS2322","severity":"error","file":"a.ets",""" +
            """"line":1,"column":5,"endLine":1,"endColumn":6,"message":"m"}]}"""

    @Test
    fun `exit code 1 with findings is a successful check`() {
        val outcome = interpret(ProcessResult.Exited(1, oneFinding, ""))

        val checked = assertInstanceOf(CheckOutcome.Checked::class.java, outcome)
        assertEquals("TS2322", checked.findings.single().code)
    }

    @Test
    fun `exit code 0 with no findings is a clean file`() {
        assertEquals(CheckOutcome.Checked(emptyList()), interpret(ProcessResult.Exited(0, """{"findings":[]}""", "")))
    }

    @Test
    fun `the exit code does not decide - JSON on standard output does`() {
        assertInstanceOf(CheckOutcome.Checked::class.java, interpret(ProcessResult.Exited(7, oneFinding, "noise")))
    }

    @Test
    fun `a usage problem is a failure that shows what the checker said`() {
        val outcome = interpret(ProcessResult.Exited(2, "", "check needs at least one file, or --stdin\n"))

        assertFailed(outcome, "exit code 2", "printed nothing", "check needs at least one file, or --stdin")
    }

    @Test
    fun `output that is not the JSON is a failure even with exit code 0`() {
        assertFailed(interpret(ProcessResult.Exited(0, "> banner\n$oneFinding", "")), "not valid JSON")
    }

    @Test
    fun `a long complaint is cut`() {
        val outcome = interpret(ProcessResult.Exited(1, "", "e".repeat(50_000)))

        assertTrue(assertInstanceOf(CheckOutcome.Failed::class.java, outcome).reason.length < 1_000)
    }

    @Test
    fun `a timeout is a failure that names the limit`() {
        assertFailed(interpret(ProcessResult.TimedOut, Duration.ofSeconds(20)), "20 seconds")
    }

    @Test
    fun `a checker that could not start is a failure that says why`() {
        assertFailed(interpret(ProcessResult.NotStarted("No such file or directory")), "No such file or directory")
    }

    private fun assertFailed(outcome: CheckOutcome, vararg expectedInReason: String) {
        val failed = assertInstanceOf(CheckOutcome.Failed::class.java, outcome)
        for (expected in expectedInReason) {
            assertTrue(failed.reason.contains(expected)) { "reason was: ${failed.reason}" }
        }
    }
}
