package io.github.alejandrolunatech.arktschecker.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Timeout
import java.io.File
import java.nio.file.Files
import java.nio.file.Path
import java.util.concurrent.TimeUnit

/**
 * Runs the real checker from the lab this plugin lives in. This is the one place where the
 * Kotlin side and the lab's `check --stdin --json` meet, so a change on either side shows here.
 *
 * It needs `node` on the PATH and the lab's dependencies installed (`npm ci` in the repository
 * root). When either is missing the tests are skipped, not failed: everything else in this
 * module needs neither. No network, no model.
 */
@Timeout(value = 120, unit = TimeUnit.SECONDS)
class LabContractTest {

    private lateinit var setup: CheckerSetup.Ready

    @BeforeEach
    fun findTheLab() {
        val lab = System.getProperty("arktsLabDirectory") ?: ""
        val node = findOnPath("node")?.toString() ?: ""
        val resolved = resolveSetup(lab, node)
        assumeTrue(resolved is CheckerSetup.Ready) { "skipped: ${(resolved as CheckerSetup.Problem).message}" }
        setup = resolved as CheckerSetup.Ready
    }

    @Test
    fun `a forbidden 'any' is found at the word itself`() {
        val text = "let x: any = 1;\n"

        val findings = check(text)

        val finding = findings.single { it.code == "arkts-no-any-unknown" }
        assertEquals(Severity.ERROR, finding.severity)
        assertEquals("arkts", finding.layer)
        assertEquals("Demo.ets", finding.file)
        val range = LineIndex(text).rangeOf(finding)
        assertEquals("any", text.substring(range.start, range.end))
    }

    @Test
    fun `a clean file has no findings`() {
        assertEquals(emptyList<Finding>(), check("let x: number = 1;\n"))
    }

    @Test
    fun `a missing brace at the end of the file is a finding with no length, inside the text`() {
        val text = "function f(): void {\n"

        val finding = check(text).first { it.layer == "syntax" }

        val range = LineIndex(text).rangeOf(finding)
        assertTrue(range.isEmpty)
        assertEquals(text.length, range.start)
    }

    @Test
    fun `positions match for Windows line breaks and characters outside the basic plane`() {
        val text = "let s: string = '😀';\r\nlet x: any = 1;\r\n"

        val finding = check(text).single { it.code == "arkts-no-any-unknown" }

        val range = LineIndex(text).rangeOf(finding)
        assertEquals("any", text.substring(range.start, range.end))
    }

    private fun check(text: String): List<Finding> {
        val outcome = runChecker(setup, "Demo.ets", text)
        return assertInstanceOf(CheckOutcome.Checked::class.java, outcome) { "the checker failed: $outcome" }.findings
    }

    private fun findOnPath(program: String): Path? =
        (System.getenv("PATH") ?: "").split(File.pathSeparator)
            .filter { it.isNotBlank() }
            .flatMap { listOf(Path.of(it, program), Path.of(it, "$program.exe")) }
            .firstOrNull { Files.isRegularFile(it) && Files.isExecutable(it) }
}
