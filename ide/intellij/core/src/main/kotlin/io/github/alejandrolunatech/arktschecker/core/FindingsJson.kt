package io.github.alejandrolunatech.arktschecker.core

import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParseException
import com.google.gson.JsonParser

/** The checker printed something that is not the JSON this plugin expects. */
class CheckerOutputException(message: String) : Exception(message)

/**
 * Reads what `check --stdin --json` prints: `{"findings":[{...}, ...]}`.
 *
 * The JSON is read as a tree and every field is taken by hand. Gson can also fill a data class
 * by reflection, but then a missing field silently becomes `null` in a property Kotlin believes
 * is never null. Here a missing field is an error with a name.
 */
fun parseFindings(json: String): List<Finding> {
    if (json.isBlank()) throw CheckerOutputException("it printed nothing")
    val root = try {
        JsonParser.parseString(json)
    } catch (e: JsonParseException) {
        throw CheckerOutputException("its output is not valid JSON")
    }
    if (!root.isJsonObject) throw CheckerOutputException("its output is not a JSON object")
    val findings = root.asJsonObject.get("findings")
    if (findings == null || !findings.isJsonArray) throw CheckerOutputException("its output has no \"findings\" array")
    return findings.asJsonArray.map { toFinding(it) }
}

private fun toFinding(element: JsonElement): Finding {
    if (!element.isJsonObject) throw CheckerOutputException("a finding is not a JSON object")
    val o = element.asJsonObject
    val line = o.int("line")
    val column = o.int("column")
    return Finding(
        layer = o.optionalString("layer") ?: "",
        code = o.string("code"),
        // Anything that is not a warning is shown as an error: better too visible than hidden.
        severity = if (o.optionalString("severity") == "warning") Severity.WARNING else Severity.ERROR,
        file = o.optionalString("file") ?: "",
        line = line,
        column = column,
        // A checker without end positions still gives usable findings: an empty range at the start.
        endLine = o.optionalInt("endLine") ?: line,
        endColumn = o.optionalInt("endColumn") ?: column,
        message = o.string("message"),
    )
}

private fun JsonObject.primitive(name: String) =
    get(name)?.takeIf { it.isJsonPrimitive }?.asJsonPrimitive

private fun JsonObject.optionalString(name: String): String? =
    primitive(name)?.takeIf { it.isString }?.asString

private fun JsonObject.optionalInt(name: String): Int? =
    primitive(name)?.takeIf { it.isNumber }?.asInt

private fun JsonObject.string(name: String): String =
    optionalString(name) ?: throw CheckerOutputException("a finding has no text \"$name\"")

private fun JsonObject.int(name: String): Int =
    optionalInt(name) ?: throw CheckerOutputException("a finding has no number \"$name\"")
