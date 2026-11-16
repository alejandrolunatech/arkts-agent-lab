package io.github.alejandrolunatech.arktschecker

import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.actionSystem.CommonDataKeys
import com.intellij.openapi.ide.CopyPasteManager
import io.github.alejandrolunatech.arktschecker.core.Finding
import io.github.alejandrolunatech.arktschecker.core.formatFeedback
import io.github.alejandrolunatech.arktschecker.core.isArkTsFileName
import java.awt.datatransfer.StringSelection

/**
 * "Copy ArkTS Checker Findings" in the editor's context menu.
 *
 * Copies the findings of the last check of this file as text, one per line. It is the same
 * text the lab's evaluation loop gives a model to repair its answer.
 *
 * It starts no check. It reads what [ArkTsExternalAnnotator] stored on the document, so the
 * text can be a few seconds behind the editor while a check is running.
 */
class CopyFindingsAction : AnAction() {

    /** `update` below only reads data the platform has already collected, so it may run off the UI thread. */
    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    /** Called often, to decide whether the menu item is shown and enabled. Must be quick. */
    override fun update(e: AnActionEvent) {
        val fileName = e.getData(CommonDataKeys.VIRTUAL_FILE)?.name
        e.presentation.isVisible = fileName != null && isArkTsFileName(fileName)
        e.presentation.isEnabled = lastFindings(e) != null
    }

    override fun actionPerformed(e: AnActionEvent) {
        val findings = lastFindings(e) ?: return
        CopyPasteManager.getInstance().setContents(StringSelection(formatFeedback(findings)))
    }

    private fun lastFindings(e: AnActionEvent): List<Finding>? =
        e.getData(CommonDataKeys.EDITOR)?.document?.getUserData(LAST_FINDINGS)
}
