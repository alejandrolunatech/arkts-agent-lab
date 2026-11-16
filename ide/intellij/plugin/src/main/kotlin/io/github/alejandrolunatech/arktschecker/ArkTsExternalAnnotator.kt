package io.github.alejandrolunatech.arktschecker

import com.intellij.lang.annotation.AnnotationHolder
import com.intellij.lang.annotation.ExternalAnnotator
import com.intellij.lang.annotation.HighlightSeverity
import com.intellij.openapi.components.service
import com.intellij.openapi.editor.Document
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.progress.ProgressManager
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.project.Project
import com.intellij.openapi.util.Key
import com.intellij.openapi.util.TextRange
import com.intellij.psi.PsiFile
import io.github.alejandrolunatech.arktschecker.core.CheckOutcome
import io.github.alejandrolunatech.arktschecker.core.CheckerSetup
import io.github.alejandrolunatech.arktschecker.core.Finding
import io.github.alejandrolunatech.arktschecker.core.LineIndex
import io.github.alejandrolunatech.arktschecker.core.OffsetRange
import io.github.alejandrolunatech.arktschecker.core.Severity
import io.github.alejandrolunatech.arktschecker.core.isArkTsFileName
import io.github.alejandrolunatech.arktschecker.core.resolveSetup
import io.github.alejandrolunatech.arktschecker.core.runChecker

/** What step 1 hands to step 2: everything the check needs, copied out of the IDE's data. */
class CheckRequest(
    val project: Project,
    val document: Document,
    val fileName: String,
    val text: String,
    val labDirectory: String,
    val nodePath: String,
)

/** What step 2 hands to step 3: each finding with the place in the text it belongs to. */
class CheckResult(val findings: List<Finding>, val ranges: List<OffsetRange>)

/**
 * The findings of the last successful check of a document, for [CopyFindingsAction].
 * User data is a small typed map every document carries; a `Key` is the entry's name and type.
 */
val LAST_FINDINGS: Key<List<Finding>> = Key.create("arktsLabChecker.lastFindings")

/**
 * Shows the lab checker's findings in the editor.
 *
 * An external annotator is the platform's place for a slow tool that runs outside the IDE.
 * The platform calls three methods, in this order, after the faster highlighting is done:
 *
 * 1. [collectInformation], inside a read action: copy what is needed. Must be quick.
 * 2. [doAnnotate], on a background thread with no lock held: run the tool. May be slow.
 * 3. [apply], inside a read action: turn the result into annotations. Must be quick.
 *
 * When the user types while step 2 runs, the platform cancels it and starts over, and it
 * skips step 3 when the text is no longer the text that was checked.
 *
 * `DumbAware` lets it run while the IDE is indexing: it uses no index.
 *
 * It is registered for every language (`language=""` in plugin.xml) and picks its files by
 * name. So it works whichever plugin owns `.ets` files in the IDE at hand.
 */
class ArkTsExternalAnnotator : ExternalAnnotator<CheckRequest, CheckResult>(), DumbAware {

    override fun collectInformation(psiFile: PsiFile, editor: Editor, hasErrors: Boolean): CheckRequest? {
        if (!isArkTsFileName(psiFile.name)) return null
        // A file can hold several languages, each with its own tree. Check it once, for the main one.
        val viewProvider = psiFile.viewProvider
        if (viewProvider.getPsi(viewProvider.baseLanguage) !== psiFile) return null

        val settings = service<ArkTsCheckerSettings>().state
        val document = editor.document
        return CheckRequest(
            project = psiFile.project,
            document = document,
            fileName = psiFile.name,
            // The text in the editor, saved or not. The checker reads it from standard input.
            text = document.text,
            labDirectory = settings.labDirectory.orEmpty(),
            nodePath = settings.nodePath.orEmpty(),
        )
    }

    override fun doAnnotate(request: CheckRequest): CheckResult? {
        // Looks at the file system, so it belongs here and not in step 1.
        val setup = when (val resolved = resolveSetup(request.labDirectory, request.nodePath)) {
            is CheckerSetup.Problem -> return failed(request, resolved.message)
            is CheckerSetup.Ready -> resolved
        }

        // `checkCanceled` throws when the platform no longer wants this result. `runChecker`
        // calls it while it waits, kills the process when it throws, and lets the exception
        // through. It must reach the platform: it is how a cancelled task ends.
        val outcome = runChecker(setup, request.fileName, request.text, checkCancelled = { ProgressManager.checkCanceled() })
        val findings = when (outcome) {
            is CheckOutcome.Failed -> return failed(request, outcome.reason)
            is CheckOutcome.Checked -> outcome.findings
        }

        service<CheckerProblemNotifier>().forget()
        // Offsets are computed here, on the background thread, against the exact text that was checked.
        val lines = LineIndex(request.text)
        return CheckResult(findings, findings.map { lines.rangeOf(it) })
    }

    override fun apply(psiFile: PsiFile, result: CheckResult?, holder: AnnotationHolder) {
        if (result == null) return
        psiFile.viewProvider.document?.putUserData(LAST_FINDINGS, result.findings)

        val textLength = psiFile.textLength
        for ((finding, range) in result.findings.zip(result.ranges)) {
            // A range outside the file would be an error in the platform. It cannot happen when
            // the text is the one that was checked, and the platform only calls us when it is.
            if (range.end > textLength) continue

            val severity = if (finding.severity == Severity.ERROR) HighlightSeverity.ERROR else HighlightSeverity.WARNING
            var annotation = holder.newAnnotation(severity, finding.displayMessage)
                .range(TextRange(range.start, range.end))
            // Nothing to underline, for example a missing brace at the end of the file:
            // draw the mark after the end of the line instead.
            if (range.isEmpty) annotation = annotation.afterEndOfLine()
            annotation.create()
        }
    }

    /** No result: tell the user once, forget the old findings, and show no annotations. */
    private fun failed(request: CheckRequest, problem: String): CheckResult? {
        service<CheckerProblemNotifier>().report(request.project, problem)
        request.document.putUserData(LAST_FINDINGS, null)
        return null
    }
}
