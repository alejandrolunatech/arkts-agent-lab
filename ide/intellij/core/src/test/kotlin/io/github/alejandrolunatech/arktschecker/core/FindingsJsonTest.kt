package io.github.alejandrolunatech.arktschecker.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class FindingsJsonTest {

    @Test
    fun `reads every field of a finding`() {
        val json = """
            {"findings":[{"layer":"arkts","code":"arkts-no-any-unknown","severity":"error","file":"demo.ets",
            "line":1,"column":8,"endLine":1,"endColumn":11,
            "message":"Use explicit types instead of \"any\", \"unknown\" (arkts-no-any-unknown)"}]}
        """.trimIndent()

        assertEquals(
            listOf(
                Finding(
                    layer = "arkts", code = "arkts-no-any-unknown", severity = Severity.ERROR, file = "demo.ets",
                    line = 1, column = 8, endLine = 1, endColumn = 11,
                    message = "Use explicit types instead of \"any\", \"unknown\" (arkts-no-any-unknown)",
                ),
            ),
            parseFindings(json),
        )
    }

    @Test
    fun `keeps the order the checker printed`() {
        val json = """{"findings":[${finding(line = 3)},${finding(line = 1)},${finding(line = 2)}]}"""

        assertEquals(listOf(3, 1, 2), parseFindings(json).map { it.line })
    }

    @Test
    fun `a clean file is an empty list`() {
        assertTrue(parseFindings("""{"findings":[]}""").isEmpty())
    }

    @Test
    fun `reads a warning`() {
        val json = """{"findings":[${finding(severity = "warning")}]}"""

        assertEquals(Severity.WARNING, parseFindings(json).single().severity)
    }

    @Test
    fun `a severity it does not know is shown as an error`() {
        val json = """{"findings":[${finding(severity = "fatal")}]}"""

        assertEquals(Severity.ERROR, parseFindings(json).single().severity)
    }

    @Test
    fun `without an end position the finding ends where it starts`() {
        val json = """{"findings":[{"code":"TS1005","line":3,"column":1,"message":"'}' expected."}]}"""

        val finding = parseFindings(json).single()

        assertEquals(3, finding.endLine)
        assertEquals(1, finding.endColumn)
    }

    @Test
    fun `ignores fields it does not know`() {
        val json = """{"version":2,"findings":[{"code":"TS1","line":1,"column":1,"message":"m","fix":{"a":1}}]}"""

        assertEquals("TS1", parseFindings(json).single().code)
    }

    @Test
    fun `no output is an error`() {
        assertRejected("", "nothing")
        assertRejected("  \n", "nothing")
    }

    @Test
    fun `text that is not JSON is an error`() {
        assertRejected("check needs at least one file, or --stdin", "not valid JSON")
    }

    @Test
    fun `a banner in front of the JSON is an error`() {
        assertRejected("> arkts-agent-lab@0.1.0 lab\n{\"findings\":[]}", "not valid JSON")
    }

    @Test
    fun `JSON of another shape is an error`() {
        assertRejected("[]", "not a JSON object")
        assertRejected("{}", "no \"findings\" array")
        assertRejected("""{"findings":{}}""", "no \"findings\" array")
        assertRejected("""{"findings":["text"]}""", "not a JSON object")
    }

    @Test
    fun `a finding without a position, a code or a message is an error`() {
        assertRejected("""{"findings":[{"code":"TS1","column":1,"message":"m"}]}""", "\"line\"")
        assertRejected("""{"findings":[{"code":"TS1","line":"1","column":1,"message":"m"}]}""", "\"line\"")
        assertRejected("""{"findings":[{"code":"TS1","line":1,"message":"m"}]}""", "\"column\"")
        assertRejected("""{"findings":[{"line":1,"column":1,"message":"m"}]}""", "\"code\"")
        assertRejected("""{"findings":[{"code":"TS1","line":1,"column":1}]}""", "\"message\"")
    }

    private fun finding(line: Int = 1, severity: String = "error") =
        """{"layer":"type","code":"TS1","severity":"$severity","file":"a.ets","line":$line,"column":1,""" +
            """"endLine":$line,"endColumn":2,"message":"m"}"""

    private fun assertRejected(json: String, expectedInMessage: String) {
        val error = assertThrows(CheckerOutputException::class.java) { parseFindings(json) }
        assertTrue(error.message!!.contains(expectedInMessage)) { "message was: ${error.message}" }
    }
}
