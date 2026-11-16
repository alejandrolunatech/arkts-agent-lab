package io.github.alejandrolunatech.arktschecker.core

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertInstanceOf
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Assertions.assertTrue
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.Timeout
import java.time.Duration
import java.util.concurrent.TimeUnit

/** Starts real processes: the test JVM running `StubProcess.java`. See [TestJvm]. */
@Timeout(value = 60, unit = TimeUnit.SECONDS)
class ProcessRunnerTest {

    private val longEnough: Duration = Duration.ofSeconds(30)

    @Test
    fun `gives the input to the process and returns its output and exit code`() {
        val input = "let s = 'año 😀';\n"

        val result = runProcess(TestJvm.stub("echo"), null, input, longEnough)

        val exited = assertInstanceOf(ProcessResult.Exited::class.java, result)
        assertEquals(input, exited.stdout)
        assertEquals(1, exited.exitCode)
    }

    @Test
    fun `an input larger than a pipe buffer goes through whole`() {
        val input = "0123456789abcdef".repeat(128 * 1024)

        val result = runProcess(TestJvm.stub("echo"), null, input, longEnough)

        assertEquals(input, assertInstanceOf(ProcessResult.Exited::class.java, result).stdout)
    }

    @Test
    fun `a process that never reads its input does not block the caller`() {
        val input = "x".repeat(2 * 1024 * 1024)

        val result = runProcess(TestJvm.stub("usage"), null, input, longEnough)

        val exited = assertInstanceOf(ProcessResult.Exited::class.java, result)
        assertEquals(2, exited.exitCode)
        assertEquals("", exited.stdout)
        assertTrue(exited.stderr.contains("stub: bad usage")) { "stderr was: ${exited.stderr}" }
    }

    @Test
    fun `a process that writes a lot before it reads does not block the caller`() {
        val result = runProcess(TestJvm.stub("flood"), null, "x".repeat(1024 * 1024), longEnough)

        val exited = assertInstanceOf(ProcessResult.Exited::class.java, result)
        assertEquals(0, exited.exitCode)
        assertEquals(512 * 1024, exited.stdout.length)
    }

    @Test
    fun `a process that does not end is stopped at the timeout`() {
        val result = runProcess(TestJvm.stub("hang"), null, "", Duration.ofMillis(500))

        assertEquals(ProcessResult.TimedOut, result)
        assertNoProcessLeft()
    }

    @Test
    fun `cancelling stops the process and passes the caller's exception on`() {
        class Cancelled : RuntimeException()
        var calls = 0

        assertThrows(Cancelled::class.java) {
            runProcess(TestJvm.stub("hang"), null, "", longEnough) {
                if (++calls == 5) throw Cancelled()
            }
        }

        assertNoProcessLeft()
    }

    @Test
    fun `a program that does not exist is reported, not thrown`() {
        val result = runProcess(listOf("/no/such/dir/no-such-program"), null, "", longEnough)

        assertInstanceOf(ProcessResult.NotStarted::class.java, result)
    }

    /** Killing is asynchronous, so give the operating system a moment before looking. */
    private fun assertNoProcessLeft() {
        val deadline = System.nanoTime() + Duration.ofSeconds(10).toNanos()
        while (liveChildren() > 0 && System.nanoTime() < deadline) Thread.sleep(50)
        assertEquals(0, liveChildren(), "processes started by this test are still running")
    }

    private fun liveChildren(): Long = ProcessHandle.current().children().filter { it.isAlive }.count()
}
