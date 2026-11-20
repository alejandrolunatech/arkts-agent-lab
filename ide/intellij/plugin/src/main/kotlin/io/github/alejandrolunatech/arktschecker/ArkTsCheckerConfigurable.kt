package io.github.alejandrolunatech.arktschecker

import com.intellij.codeInsight.daemon.DaemonCodeAnalyzer
import com.intellij.openapi.components.service
import com.intellij.openapi.fileChooser.FileChooserDescriptorFactory
import com.intellij.openapi.options.Configurable
import com.intellij.openapi.project.ProjectManager
import com.intellij.openapi.ui.TextFieldWithBrowseButton
import com.intellij.util.ui.FormBuilder
import javax.swing.JComponent
import javax.swing.JPanel

/**
 * The page under Settings | Tools | ArkTS Lab Checker.
 *
 * The platform drives it: `createComponent` builds the form, `reset` fills it from the saved
 * settings, `isModified` tells the dialog whether to enable Apply, `apply` saves, and
 * `disposeUIResources` is called when the dialog closes. All of them run on the UI thread, so
 * none of them touches the checker or the file system.
 */
class ArkTsCheckerConfigurable : Configurable {

    private var labField: TextFieldWithBrowseButton? = null
    private var nodeField: TextFieldWithBrowseButton? = null

    override fun getDisplayName(): String = "ArkTS Lab Checker"

    override fun createComponent(): JComponent {
        val lab = TextFieldWithBrowseButton()
        lab.addBrowseFolderListener(null, FileChooserDescriptorFactory.createSingleFolderDescriptor().withTitle("Select the arkts-agent-lab Checkout"))
        val node = TextFieldWithBrowseButton()
        node.addBrowseFolderListener(null, FileChooserDescriptorFactory.createSingleFileNoJarsDescriptor().withTitle("Select the Node Executable"))
        labField = lab
        nodeField = node

        return FormBuilder.createFormBuilder()
            .addLabeledComponent("Lab checkout:", lab)
            .addTooltip("The arkts-agent-lab folder, with its dependencies installed (npm ci).")
            .addLabeledComponent("Node executable:", node)
            .addTooltip("The full path to node, for example the output of \"which node\".")
            .addComponentFillVertically(JPanel(), 0)
            .panel
    }

    override fun isModified(): Boolean {
        val saved = service<ArkTsCheckerSettings>().state
        return entered(labField) != saved.labDirectory.orEmpty() || entered(nodeField) != saved.nodePath.orEmpty()
    }

    override fun apply() {
        val saved = service<ArkTsCheckerSettings>().state
        saved.labDirectory = entered(labField)
        saved.nodePath = entered(nodeField)

        // New paths can fix the problem, or bring a new one: let it be reported again.
        service<CheckerProblemNotifier>().forget()
        // Ask every open project to analyse its open files again, so the new paths are used now.
        // restart(reason) would name the cause in the log, but IntelliJ Platform 2024.3 does not have it yet.
        for (project in ProjectManager.getInstance().openProjects) {
            DaemonCodeAnalyzer.getInstance(project).restart()
        }
    }

    override fun reset() {
        val saved = service<ArkTsCheckerSettings>().state
        labField?.setText(saved.labDirectory.orEmpty())
        nodeField?.setText(saved.nodePath.orEmpty())
    }

    override fun disposeUIResources() {
        labField = null
        nodeField = null
    }

    private fun entered(field: TextFieldWithBrowseButton?): String = field?.text?.trim().orEmpty()
}
