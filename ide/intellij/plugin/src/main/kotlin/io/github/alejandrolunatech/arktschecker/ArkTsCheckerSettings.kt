package io.github.alejandrolunatech.arktschecker

import com.intellij.openapi.components.BaseState
import com.intellij.openapi.components.RoamingType
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.SimplePersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage

/**
 * The two paths the user sets, kept between IDE restarts.
 *
 * `@Service` makes this an application service: one instance for the whole IDE, created the
 * first time somebody asks for it with `service<ArkTsCheckerSettings>()`.
 * `@State` says where the platform stores it: `arkts-lab-checker.xml` in the IDE's options folder.
 * The platform reads and writes that file; this class never touches it.
 *
 * Roaming is off because these are paths on this machine, and they would be wrong on another.
 * The SDK documentation also requires it for a service declared with the annotation alone.
 */
@Service(Service.Level.APP)
@State(
    name = "ArkTsLabCheckerSettings",
    storages = [Storage(value = "arkts-lab-checker.xml", roamingType = RoamingType.DISABLED)],
)
class ArkTsCheckerSettings : SimplePersistentStateComponent<ArkTsCheckerSettings.State>(State()) {

    /** `by string()` gives a nullable String property that the platform can save and that knows when it changed. */
    class State : BaseState() {
        var labDirectory by string()
        var nodePath by string()
    }
}
