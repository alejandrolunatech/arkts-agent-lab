package io.github.alejandrolunatech.arktschecker

import com.intellij.notification.Notification
import com.intellij.notification.NotificationAction
import com.intellij.notification.NotificationType
import com.intellij.openapi.components.Service
import com.intellij.openapi.options.ShowSettingsUtil
import com.intellij.openapi.project.Project
import java.util.concurrent.atomic.AtomicReference

/**
 * Tells the user that the checker is not running, once per problem.
 *
 * The check runs again after every edit. Without a memory, a wrong path would produce a new
 * balloon every few seconds. This service remembers the last problem it reported and stays
 * quiet while the problem is the same. [forget] is called when a check works or the settings
 * change, so the next problem is reported again.
 *
 * It is called from a background thread. `notify` may be: the platform moves the balloon to
 * the UI thread itself.
 */
@Service(Service.Level.APP)
class CheckerProblemNotifier {

    private val lastReported = AtomicReference<String?>(null)

    fun report(project: Project, problem: String) {
        if (lastReported.getAndSet(problem) == problem) return

        Notification(NOTIFICATION_GROUP, "The ArkTS checker is not running", problem, NotificationType.WARNING)
            .addAction(
                NotificationAction.createSimpleExpiring(
                    "Open settings",
                    Runnable { ShowSettingsUtil.getInstance().showSettingsDialog(project, ArkTsCheckerConfigurable::class.java) },
                ),
            )
            .notify(project)
    }

    fun forget() {
        lastReported.set(null)
    }

    private companion object {
        /** Must be the `id` of the `<notificationGroup>` in plugin.xml. */
        const val NOTIFICATION_GROUP = "ArkTS Lab Checker"
    }
}
