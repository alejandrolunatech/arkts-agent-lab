package io.github.alejandrolunatech.arktschecker.core

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.nio.file.Path
import java.time.Duration
import java.util.concurrent.Future
import java.util.concurrent.FutureTask
import kotlin.concurrent.thread

/** How a started (or not started) process ended. */
sealed interface ProcessResult {
    data class Exited(val exitCode: Int, val stdout: String, val stderr: String) : ProcessResult
    data object TimedOut : ProcessResult
    data class NotStarted(val reason: String) : ProcessResult
}

private const val POLL_MILLIS = 25L

/**
 * Runs a command, gives it [stdin] on standard input, and waits for it to end.
 *
 * The calling thread blocks until the process ends, [timeout] passes, or [checkCancelled]
 * throws. So the caller must not be a thread that has to stay responsive, such as a UI thread.
 *
 * [checkCancelled] is called every few milliseconds while waiting. To cancel, it throws; the
 * process is then killed and the exception goes on to the caller. An IDE passes its own
 * "has the user moved on?" check here, and this file does not need to know about any IDE.
 *
 * The three streams are each handled by their own thread. A process that writes a lot before
 * it reads, or reads nothing at all, would otherwise block against a full pipe forever.
 */
fun runProcess(
    command: List<String>,
    workingDirectory: Path?,
    stdin: String,
    timeout: Duration,
    checkCancelled: () -> Unit = {},
): ProcessResult {
    val process = try {
        ProcessBuilder(command).directory(workingDirectory?.toFile()).start()
    } catch (e: IOException) {
        return ProcessResult.NotStarted(e.message ?: e.javaClass.simpleName)
    }
    try {
        val stdout = readInBackground(process.inputStream)
        val stderr = readInBackground(process.errorStream)
        writeInBackground(process.outputStream, stdin)

        val deadline = System.nanoTime() + timeout.toNanos()
        while (process.isAlive || !stdout.isDone || !stderr.isDone) {
            checkCancelled()
            if (System.nanoTime() >= deadline) return ProcessResult.TimedOut
            Thread.sleep(POLL_MILLIS)
        }
        return ProcessResult.Exited(process.exitValue(), stdout.get(), stderr.get())
    } finally {
        // Does nothing after a normal exit. After a timeout, a cancellation or any other
        // exception, it makes sure no checker keeps running in the background.
        killWithChildren(process)
    }
}

/** `tsx` starts a second `node` process to do the work, so killing only the first one is not enough. */
private fun killWithChildren(process: Process) {
    process.descendants().forEach { it.destroyForcibly() }
    process.destroyForcibly()
}

private fun readInBackground(stream: InputStream): Future<String> {
    val task = FutureTask {
        val bytes = ByteArrayOutputStream()
        try {
            stream.use { it.copyTo(bytes) }
        } catch (e: IOException) {
            // The process was killed while we were reading. Keep what arrived.
        }
        bytes.toString(Charsets.UTF_8)
    }
    thread(isDaemon = true, name = "arkts-checker-output") { task.run() }
    return task
}

private fun writeInBackground(stream: OutputStream, text: String) {
    thread(isDaemon = true, name = "arkts-checker-input") {
        try {
            stream.use { it.write(text.toByteArray(Charsets.UTF_8)) }
        } catch (e: IOException) {
            // The process ended without reading its input. Its exit code and output say why.
        }
    }
}
