package io.github.softcoder183.etucep

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.os.PowerManager
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.MimeTypeMap
import android.webkit.WebView
import android.widget.Toast
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/**
 * WebView'deki çekirdeğin (mobile/core.mjs) telefonla konuştuğu köprü. Ön plandaki uygulama da arka plan kontrolü de aynı sınıfı kullanır.
 * Dosya ve şifreleme çağrıları eşzamanlıdır; ağ ve ekran gerektiren işler bitince __done(id, json) çağrılır.
 */
class Native(private val context: Context, private val onBackgroundDone: () -> Unit = {}) {
    lateinit var web: WebView
    private val main = Handler(Looper.getMainLooper())
    private val bodies = ConcurrentHashMap<Int, String>()

    private fun file(path: String): File {
        val root = context.filesDir.canonicalFile
        val f = File(root, path).canonicalFile
        require(f.path.startsWith(root.path)) { "Geçersiz yol" }
        return f
    }

    private fun done(id: Int, json: JSONObject) = main.post {
        web.evaluateJavascript("__done($id," + JSONObject.quote(json.toString()) + ")", null)
    }
    private fun fail(id: Int, e: Throwable) = done(id, JSONObject().put("error", e.message ?: "İşlem yapılamadı"))

    // ---------- dosyalar ----------
    @JavascriptInterface fun fsRead(path: String): String? = runCatching {
        val bytes = if (path.startsWith("/app/")) context.assets.open(path.removePrefix("/")).use { it.readBytes() }
        else file(path).takeIf { it.isFile }?.readBytes()
        bytes?.let { Base64.encodeToString(it, Base64.NO_WRAP) }
    }.getOrNull()
    @JavascriptInterface fun fsWrite(path: String, b64: String) = Vault.atomic(file(path), Base64.decode(b64, Base64.NO_WRAP))
    @JavascriptInterface fun fsAppend(path: String, b64: String) { val f = file(path); f.parentFile?.mkdirs(); f.appendBytes(Base64.decode(b64, Base64.NO_WRAP)) }
    @JavascriptInterface fun fsExists(path: String): Boolean = file(path).exists()
    @JavascriptInterface fun fsRemove(path: String) { file(path).deleteRecursively() }
    @JavascriptInterface fun fsList(path: String): String = JSONArray((file(path).list() ?: emptyArray()).toList()).toString()

    // ---------- şifreli dosyalar ----------
    @JavascriptInterface fun sealRead(path: String): String? = Vault.read(context, file(path))
    @JavascriptInterface fun sealWrite(path: String, text: String) = Vault.write(context, file(path), text)

    // ---------- ağ ----------
    @JavascriptInterface fun http(id: Int, json: String) = pool.execute {
        try {
            val r = JSONObject(json)
            val res = Http.request(r)
            bodies[id] = Base64.encodeToString(res.body, Base64.NO_WRAP)
            done(id, JSONObject().put("status", res.status).put("url", res.url).put("headers", JSONArray(res.headers.map { JSONArray(listOf(it.first, it.second)) })))
        } catch (e: Exception) { fail(id, e) }
    }
    @JavascriptInterface fun takeBody(id: Int): String? = bodies.remove(id)

    // ---------- giriş ----------
    @JavascriptInterface fun openLogin(id: Int, json: String) {
        LoginBroker.pending = { r -> r.onSuccess { done(id, JSONObject().put("cookies", it)) }.onFailure { fail(id, it) } }
        context.startActivity(Intent(context, LoginActivity::class.java).putExtra("ayar", json).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    @JavascriptInterface fun webCookies(base: String): String = LoginBroker.cookies(base).toString()
    @JavascriptInterface fun clearWebCookies(host: String) {
        val cm = CookieManager.getInstance()
        val base = "https://$host"
        cm.getCookie(base)?.split(";")?.forEach { cm.setCookie(base, it.substringBefore("=").trim() + "=; Max-Age=0") }
        cm.flush()
    }

    // ---------- bildirim ve sistem ----------
    @JavascriptInterface fun notify(title: String, body: String, link: String) = Notifications.show(context, title, body, link)
    @JavascriptInterface fun notificationsAllowed(): Boolean = Notifications.allowed(context)
    @JavascriptInterface fun askNotifications() { (context as? Activity)?.let { Notifications.ask(it) } }
    @JavascriptInterface fun batteryFree(): Boolean = (context.getSystemService(Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(context.packageName)
    @SuppressLint("BatteryLife")
    @JavascriptInterface fun askBattery() {
        context.startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + context.packageName)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
    @JavascriptInterface fun backgroundDone() = main.post { onBackgroundDone() }.let { }
    @JavascriptInterface fun appVersion(): String = context.packageManager.getPackageInfo(context.packageName, 0).versionName ?: "0"
    @JavascriptInterface fun openUrl(url: String) {
        if (!url.startsWith("https://") && !url.startsWith("http://") && !url.startsWith("mailto:")) return
        runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }
    @JavascriptInterface fun showToast(text: String) = main.post { Toast.makeText(context, text, Toast.LENGTH_LONG).show() }.let { }
    @JavascriptInterface fun setBars(dark: Boolean) { (context as? MainActivity)?.setBars(dark) }

    // ---------- dosya kaydetme ve PDF ----------
    @JavascriptInterface fun saveFile(name: String, type: String, b64: String) = pool.execute {
        try {
            val clean = name.replace(Regex("[\\\\/:*?\"<>|]"), "_")
            val mime = type.substringBefore(";").takeUnless { it == "application/octet-stream" }
                ?: MimeTypeMap.getSingleton().getMimeTypeFromExtension(clean.substringAfterLast('.', "").lowercase()) ?: "application/octet-stream"
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, clean)
                put(MediaStore.Downloads.MIME_TYPE, mime)
                put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            }
            val uri = context.contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: error("Dosya kaydedilemedi")
            context.contentResolver.openOutputStream(uri)!!.use { it.write(Base64.decode(b64, Base64.NO_WRAP)) }
            showToast("$clean İndirilenler klasörüne kaydedildi")
            val open = Intent(Intent.ACTION_VIEW).setDataAndType(uri, mime).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
            runCatching { context.startActivity(open) }
        } catch (e: Exception) { showToast(e.message ?: "Dosya kaydedilemedi") }
    }
    @JavascriptInterface fun htmlToPdf(id: Int, html: String) = main.post {
        Pdf.fromHtml(context, html) { r ->
            r.onSuccess { bodies[id] = Base64.encodeToString(it, Base64.NO_WRAP); done(id, JSONObject().put("id", id)) }.onFailure { fail(id, it) }
        }
    }.let { }

    // ---------- güncelleme ----------
    /** APK indirilir, GitHub'ın SHA-256 özetiyle doğrulanır, sonra Android'in kurulum ekranı açılır. Kurulumu kullanıcı onaylar. */
    @JavascriptInterface fun installApk(id: Int, url: String, sha256: String) = pool.execute {
        try {
            if (!url.startsWith("https://github.com/Soft-Coder-183/ortam-sade/releases/download/")) error("Beklenmeyen indirme adresi")
            val dir = File(context.cacheDir, "guncelleme").apply { deleteRecursively(); mkdirs() }
            val apk = File(dir, "guncelleme.apk")
            val digest = MessageDigest.getInstance("SHA-256")
            var next = URL(url)
            var conn: HttpURLConnection
            var hops = 0
            while (true) {                                  // GitHub indirmeleri https yönlendirmesiyle gelir
                conn = next.openConnection() as HttpURLConnection
                conn.instanceFollowRedirects = false
                conn.connectTimeout = 30_000; conn.readTimeout = 120_000
                if (conn.responseCode !in 300..399 || ++hops > 6) break
                next = URL(next, conn.getHeaderField("Location"))
                require(next.protocol == "https") { "Güvensiz yönlendirme" }
            }
            if (conn.responseCode != 200) error("İndirilemedi (${conn.responseCode})")
            conn.inputStream.use { input -> apk.outputStream().use { out ->
                val buf = ByteArray(64 * 1024)
                while (true) { val n = input.read(buf); if (n < 0) break; digest.update(buf, 0, n); out.write(buf, 0, n) }
            } }
            val got = digest.digest().joinToString("") { "%02x".format(it) }
            if (got != sha256) { apk.delete(); error("Dosya doğrulanamadı, kurulum iptal edildi") }
            if (!context.packageManager.canRequestPackageInstalls())
                context.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + context.packageName)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            val uri = FileProvider.getUriForFile(context, context.packageName + ".dosya", apk)
            context.startActivity(Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK))
            done(id, JSONObject().put("ok", true))
        } catch (e: Exception) { fail(id, e) }
    }

    companion object { private val pool = Executors.newFixedThreadPool(6) }
}
