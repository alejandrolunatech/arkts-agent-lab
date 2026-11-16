package io.github.alejandrolunatech.arktschecker.core

/** A range of characters in a text: `start` inclusive, `end` exclusive, both 0-based offsets. */
data class OffsetRange(val start: Int, val end: Int) {
    val isEmpty: Boolean get() = start == end
}

/**
 * Turns the checker's 1-based line and column into 0-based offsets in a text.
 *
 * It must count lines exactly as the checker does, for the same text the checker saw.
 * The checker is the TypeScript compiler, which ends a line at `\n`, `\r\n`, a lone `\r`,
 * and the Unicode line and paragraph separators. Columns count UTF-16 code units, which is
 * also how a Kotlin `String` is indexed, so no conversion is needed there.
 *
 * Every result is clamped to the text. A finding can never produce an offset outside it,
 * whatever the checker prints.
 */
class LineIndex(private val text: String) {

    /** Offset of the first character of each line. There is always at least one line. */
    private val lineStarts: IntArray = buildList {
        add(0)
        var i = 0
        while (i < text.length) {
            val c = text[i]
            i++
            if (c == '\r' && i < text.length && text[i] == '\n') i++
            if (c == '\r' || c == '\n' || c == LINE_SEPARATOR || c == PARAGRAPH_SEPARATOR) add(i)
        }
    }.toIntArray()

    val lineCount: Int get() = lineStarts.size

    fun offsetOf(line: Int, column: Int): Int {
        if (line < 1) return 0
        if (line > lineCount) return text.length
        val lineStart = lineStarts[line - 1]
        val nextLineStart = if (line < lineCount) lineStarts[line] else text.length
        return (lineStart + column - 1).coerceIn(lineStart, nextLineStart)
    }

    /**
     * The range a finding covers.
     *
     * A finding with no length is widened to the one character at its position, so there is
     * something to underline. When there is no character there (end of a line, end of the
     * text), the range stays empty and the caller decides how to show it.
     */
    fun rangeOf(finding: Finding): OffsetRange {
        val start = offsetOf(finding.line, finding.column)
        val end = offsetOf(finding.endLine, finding.endColumn).coerceAtLeast(start)
        if (end > start) return OffsetRange(start, end)
        val hasCharacterAtStart = start < text.length && !isLineBreak(text[start])
        return if (hasCharacterAtStart) OffsetRange(start, start + 1) else OffsetRange(start, start)
    }

    private fun isLineBreak(c: Char) =
        c == '\r' || c == '\n' || c == LINE_SEPARATOR || c == PARAGRAPH_SEPARATOR

    private companion object {
        const val LINE_SEPARATOR = ' '
        const val PARAGRAPH_SEPARATOR = ' '
    }
}
