package io.github.alejandrolunatech.arktschecker.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertFalse
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import java.nio.file.Files
import java.nio.file.Path

class CheckerSetupTest {

    @TempDir
    lateinit var temp: Path

    /** The JVM running this test: an executable file that exists on every machine that runs it. */
    private val anExecutable: String = TestJvm.javaExecutable.toString()

    @Test
    fun `recognises ArkTS file names`() {
        assertTrue(isArkTsFileName("Index.ets"))
        assertTrue(isArkTsFileName("INDEX.ETS"))
        assertFalse(isArkTsFileName("Index.ts"))
        assertFalse(isArkTsFileName("ets"))
        assertFalse(isArkTsFileName("notes.ets.txt"))
    }

    @Test
    fun `no lab path is a problem that says so`() {
        assertProblem(resolveSetup("", anExecutable), "checkout is not set")
        assertProblem(resolveSetup("   ", anExecutable), "checkout is not set")
    }

    @Test
    fun `no node path is a problem that says so`() {
        assertProblem(resolveSetup(aLab().toString(), ""), "node executable is not set")
    }

    @Test
    fun `a lab path that is not a directory is a problem`() {
        assertProblem(resolveSetup(temp.resolve("missing").toString(), anExecutable), "not a directory")
    }

    @Test
    fun `a directory without the lab's command line program is a problem`() {
        assertProblem(resolveSetup(temp.toString(), anExecutable), "not an arkts-agent-lab checkout")
    }

    @Test
    fun `a lab without installed dependencies is a problem that says how to install them`() {
        val lab = aLab(withDependencies = false)

        assertProblem(resolveSetup(lab.toString(), anExecutable), "npm ci")
    }

    @Test
    fun `a node path that does not exist is a problem`() {
        assertProblem(resolveSetup(aLab().toString(), temp.resolve("no-node").toString()), "not an executable file")
    }

    @Test
    fun `a node path that is a directory is a problem`() {
        assertProblem(resolveSetup(aLab().toString(), temp.toString()), "not an executable file")
    }

    @Test
    fun `a path the file system cannot express is a problem, not an exception`() {
        assertInstanceOf(CheckerSetup.Problem::class.java, resolveSetup("lab\u0000dir", anExecutable))
    }

    @Test
    fun `two good paths are ready, with surrounding spaces removed`() {
        val lab = aLab()

        val setup = resolveSetup("  $lab  ", " $anExecutable ")

        assertEquals(CheckerSetup.Ready(lab, Path.of(anExecutable)), setup)
    }

    @Test
    fun `the command starts node on tsx and the lab's program, with one element per argument`() {
        val lab = Path.of("/work/my lab")
        val setup = CheckerSetup.Ready(lab, Path.of("/usr/local/bin/node"))

        assertEquals(
            listOf(
                Path.of("/usr/local/bin/node").toString(),
                lab.resolve("node_modules/tsx/dist/cli.mjs").toString(),
                lab.resolve("src/cli.ts").toString(),
                "check", "--stdin", "--json", "--filename", "Index.ets",
            ),
            setup.commandFor("Index.ets"),
        )
    }

    private fun aLab(withDependencies: Boolean = true): Path {
        val lab = Files.createDirectory(temp.resolve("lab"))
        Files.createDirectories(lab.resolve("src"))
        Files.writeString(lab.resolve(LAB_CLI), "")
        if (withDependencies) {
            Files.createDirectories(lab.resolve(TSX_ENTRY).parent)
            Files.writeString(lab.resolve(TSX_ENTRY), "")
        }
        return lab
    }

    private fun assertProblem(setup: CheckerSetup, expectedInMessage: String) {
        val problem = assertInstanceOf(CheckerSetup.Problem::class.java, setup)
        assertTrue(problem.message.contains(expectedInMessage)) { "message was: ${problem.message}" }
    }
}
