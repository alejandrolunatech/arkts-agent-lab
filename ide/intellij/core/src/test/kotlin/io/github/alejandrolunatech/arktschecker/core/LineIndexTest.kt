package io.github.alejandrolunatech.arktschecker.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test

class LineIndexTest {

    @Test
    fun `line 1 column 1 is offset 0`() {
        assertEquals(0, LineIndex("let x = 1;").offsetOf(1, 1))
    }

    @Test
    fun `columns count from 1 within the line`() {
        val text = "let a = 1;\nlet b = 2;\n"

        assertEquals(4, LineIndex(text).offsetOf(1, 5))
        assertEquals(15, LineIndex(text).offsetOf(2, 5))
        assertEquals('b', text[LineIndex(text).offsetOf(2, 5)])
    }

    @Test
    fun `a Windows line break is one break, not two`() {
        val text = "a\r\nb\r\nc"

        assertEquals(3, LineIndex(text).lineCount)
        assertEquals('b', text[LineIndex(text).offsetOf(2, 1)])
        assertEquals('c', text[LineIndex(text).offsetOf(3, 1)])
    }

    @Test
    fun `a lone carriage return and the Unicode separators end a line too`() {
        val text = "a\rb c d"

        val index = LineIndex(text)

        assertEquals(4, index.lineCount)
        assertEquals(listOf('a', 'b', 'c', 'd'), (1..4).map { text[index.offsetOf(it, 1)] })
    }

    @Test
    fun `a text that ends with a line break has an empty last line`() {
        val text = "a\n"

        assertEquals(2, LineIndex(text).lineCount)
        assertEquals(text.length, LineIndex(text).offsetOf(2, 1))
    }

    @Test
    fun `an empty text has one empty line`() {
        assertEquals(1, LineIndex("").lineCount)
        assertEquals(0, LineIndex("").offsetOf(1, 1))
    }

    @Test
    fun `a character outside the basic plane takes two columns, as in the checker`() {
        val text = "let s = '😀'; x"

        assertEquals('x', text[LineIndex(text).offsetOf(1, 15)])
    }

    @Test
    fun `positions outside the text are pulled back into it`() {
        val text = "ab\ncd"
        val index = LineIndex(text)

        assertEquals(0, index.offsetOf(0, 1))
        assertEquals(0, index.offsetOf(-3, 7))
        assertEquals(0, index.offsetOf(1, 0))
        assertEquals(0, index.offsetOf(1, -5))
        assertEquals(text.length, index.offsetOf(99, 1))
        assertEquals(text.length, index.offsetOf(2, 99))
    }

    @Test
    fun `a column past the end of a line stops at the start of the next line`() {
        assertEquals(3, LineIndex("ab\ncd").offsetOf(1, 99))
    }

    @Test
    fun `a finding covers the text between its start and its end`() {
        val text = "let x: any = 1;\n"

        val range = LineIndex(text).rangeOf(finding(line = 1, column = 8, endLine = 1, endColumn = 11))

        assertEquals("any", text.substring(range.start, range.end))
    }

    @Test
    fun `a finding can span lines`() {
        val text = "f(\n  1,\n);\n"

        val range = LineIndex(text).rangeOf(finding(line = 1, column = 1, endLine = 3, endColumn = 2))

        assertEquals("f(\n  1,\n)", text.substring(range.start, range.end))
    }

    @Test
    fun `a finding with no length is widened to the character at its position`() {
        val text = "let x = ;\n"

        val range = LineIndex(text).rangeOf(finding(line = 1, column = 9, endLine = 1, endColumn = 9))

        assertEquals(";", text.substring(range.start, range.end))
    }

    @Test
    fun `a finding with no length at the end of a line stays empty`() {
        val text = "let x =\nlet y = 1;\n"

        val range = LineIndex(text).rangeOf(finding(line = 1, column = 8, endLine = 1, endColumn = 8))

        assertEquals(OffsetRange(7, 7), range)
        assertTrue(range.isEmpty)
    }

    @Test
    fun `a finding with no length at the very end of the text stays empty and inside the text`() {
        val text = "let x: number = 1;\nfunction f() {\n"

        val range = LineIndex(text).rangeOf(finding(line = 3, column = 1, endLine = 3, endColumn = 1))

        assertEquals(OffsetRange(text.length, text.length), range)
    }

    @Test
    fun `a finding in an empty text is the empty range at 0`() {
        assertEquals(OffsetRange(0, 0), LineIndex("").rangeOf(finding(line = 1, column = 1, endLine = 1, endColumn = 1)))
    }

    @Test
    fun `an end before the start is treated as no length`() {
        val text = "abc def"

        val range = LineIndex(text).rangeOf(finding(line = 1, column = 5, endLine = 1, endColumn = 2))

        assertEquals("d", text.substring(range.start, range.end))
    }

    @Test
    fun `a finding far outside the text never leaves it`() {
        val text = "abc"

        val range = LineIndex(text).rangeOf(finding(line = 40, column = 2, endLine = 41, endColumn = 9))

        assertEquals(OffsetRange(3, 3), range)
    }

    private fun finding(line: Int, column: Int, endLine: Int, endColumn: Int) = Finding(
        layer = "type", code = "TS1", severity = Severity.ERROR, file = "a.ets",
        line = line, column = column, endLine = endLine, endColumn = endColumn, message = "m",
    )
}
