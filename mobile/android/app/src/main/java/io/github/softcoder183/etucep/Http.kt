package io.github.softcoder183.etucep

import android.util.Base64
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL

/** Okul sitelerine istek. Çerezleri çekirdek yönetir: burada otomatik çerez ya da önbellek yoktur, Set-Cookie satırları olduğu gibi döner. */
object Http {
    class Res(val status: Int, val url: String, val headers: List<Pair<String, String>>, val body: ByteArray)

    fun request(r: JSONObject): Res {
        var url = URL(r.getString("url"))
        var method = r.optString("method", "GET")
        val manual = r.optString("redirect", "follow") == "manual"
        val headers = r.optJSONObject("headers") ?: JSONObject()
        var body = if (r.isNull("body")) null else Base64.decode(r.getString("body"), Base64.NO_WRAP)
        var hops = 0
        while (true) {
            val c = url.openConnection() as HttpURLConnection
            c.instanceFollowRedirects = false
            c.useCaches = false
            c.connectTimeout = 20_000
            c.readTimeout = 60_000
            c.requestMethod = method
            for (k in headers.keys()) c.setRequestProperty(k, headers.getString(k))
            if (body != null && method != "GET" && method != "HEAD") {
                c.doOutput = true
                c.setFixedLengthStreamingMode(body.size)
                c.outputStream.use { it.write(body!!) }
            }
            val status = c.responseCode
            val list = ArrayList<Pair<String, String>>()
            for ((k, vs) in c.headerFields) if (k != null) for (v in vs) list.add(k to v)
            val location = c.getHeaderField("Location")
            if (!manual && status in 300..399 && location != null && hops++ < 10) {
                c.disconnect()
                url = URL(url, location)
                if (status != 307 && status != 308) { method = "GET"; body = null }
                continue
            }
            val stream = if (status >= 400) c.errorStream else runCatching { c.inputStream }.getOrNull()
            val out = ByteArrayOutputStream()
            stream?.use { it.copyTo(out) }
            c.disconnect()
            return Res(status, url.toString(), list, out.toByteArray())
        }
    }
}
