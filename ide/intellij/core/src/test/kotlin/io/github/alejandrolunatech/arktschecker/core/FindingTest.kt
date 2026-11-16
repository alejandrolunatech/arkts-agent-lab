package io.github.alejandrolunatech.arktschecker.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test

class FindingTest {

    private val linterFinding = Finding(
        layer = "arkts", code = "arkts-no-any-unknown", severity = Severity.ERROR, file = "demo.ets",
        line = 1, column = 8, endLine = 1, endColumn = 11,
        message = "Use explicit types instead of \"any\", \"unknown\" (arkts-no-any-unknown)",
    )

    private val compilerFinding = Finding(
        layer = "type", code = "TS2322", severity = Severity.WARNING, file = "demo.ets",
        line = 2, column = 5, endLine = 2, endColumn = 6,
        message = "Type 'string' is not assignable to type 'number'.",
    )

    @Test
    fun `a linter message already names its rule and is shown as it is`() {
        assertEquals(linterFinding.message, linterFinding.displayMessage)
    }

    @Test
    fun `a compiler message gets its code in front`() {
        assertEquals("TS2322: Type 'string' is not assignable to type 'number'.", compilerFinding.displayMessage)
    }

    @Test
    fun `a feedback line has file, position, severity, code and message`() {
        assertEquals(
            "demo.ets:2:5 warning [TS2322] Type 'string' is not assignable to type 'number'.",
            compilerFinding.toFeedbackLine(),
        )
    }

    @Test
    fun `feedback ends with the number of errors`() {
        assertEquals(
            listOf(linterFinding.toFeedbackLine(), compilerFinding.toFeedbackLine(), "1 error(s).").joinToString("\n"),
            formatFeedback(listOf(linterFinding, compilerFinding)),
        )
    }

    @Test
    fun `feedback for a clean file says so`() {
        assertEquals("No errors.", formatFeedback(emptyList()))
    }
}
