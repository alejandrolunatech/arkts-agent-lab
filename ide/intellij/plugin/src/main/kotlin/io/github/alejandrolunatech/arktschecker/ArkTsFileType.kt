package io.github.alejandrolunatech.arktschecker

import com.intellij.icons.AllIcons
import com.intellij.openapi.fileTypes.FileType
import com.intellij.openapi.fileTypes.FileTypeRegistry
import com.intellij.openapi.fileTypes.LanguageFileType
import com.intellij.openapi.fileTypes.PlainTextLanguage
import com.intellij.openapi.util.io.ByteSequence
import com.intellij.openapi.vfs.VirtualFile
import io.github.alejandrolunatech.arktschecker.core.isArkTsFileName
import javax.swing.Icon

/**
 * A name and an icon for `.ets` files in an IDE that knows nothing about them.
 *
 * It reuses the platform's plain text language, so there is no lexer, no parser and no syntax
 * highlighting here. `secondary = true` tells the platform that plain text already has its own
 * file type and this one only borrows the language. For the same reason the `<fileType>` element
 * in plugin.xml has no `language` attribute: the platform expects none on a secondary file type.
 *
 * A file type is the one extension the SDK documentation allows to be a Kotlin `object`:
 * plugin.xml points at the `INSTANCE` field the compiler generates for it.
 */
object ArkTsFileType : LanguageFileType(PlainTextLanguage.INSTANCE, true) {
    override fun getName(): String = "ArkTS Lab"
    override fun getDescription(): String = "ArkTS source, as plain text"
    override fun getDefaultExtension(): String = "ets"
    override fun getIcon(): Icon = AllIcons.FileTypes.Text
}

/**
 * Gives `.ets` files the type above, but only when nothing else claims them.
 *
 * The usual way is `extensions="ets"` on the `<fileType>` element. This plugin does not do that
 * on purpose. When an installed plugin and a bundled plugin both declare the same extension, the
 * platform quietly gives it to the installed one. In an IDE that ships its own ArkTS support,
 * that would replace the real ArkTS file type with this plain text one.
 *
 * A detector is asked later: only for a file whose name matched no pattern of any file type.
 * So in an IDE that already knows `.ets`, this class is never called.
 */
class ArkTsFileTypeDetector : FileTypeRegistry.FileTypeDetector {
    override fun detect(file: VirtualFile, firstBytes: ByteSequence, firstCharsIfText: CharSequence?): FileType? {
        val isText = firstCharsIfText != null
        return if (isText && isArkTsFileName(file.name)) ArkTsFileType else null
    }
}
