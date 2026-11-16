package io.github.alejandrolunatech.arktschecker.core

import java.nio.file.Files
import java.nio.file.Path

/**
 * Test helper. The process tests need a real program to start, one that exists wherever the
 * tests run. The JVM that runs the tests is such a program: `java StubProcess.java <mode>`
 * compiles and runs one source file, with no build step.
 */
object TestJvm {

    val javaExecutable: Path = sequenceOf("java", "java.exe")
        .map { Path.of(System.getProperty("java.home"), "bin", it) }
        .first { Files.isExecutable(it) }

    private val stubSource: Path =
        Path.of(checkNotNull(javaClass.getResource("/StubProcess.java")) { "StubProcess.java is missing" }.toURI())

    /** The command line that runs `StubProcess.java` in the given mode. */
    fun stub(mode: String): List<String> = listOf(javaExecutable.toString(), stubSource.toString(), mode)
}
