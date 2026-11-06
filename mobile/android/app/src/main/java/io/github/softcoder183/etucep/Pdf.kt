package io.github.softcoder183.etucep

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.print.PdfPrint
import android.print.PrintAttributes
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.File

/** UBS belgelerini aynı şablonla PDF'e çevirir. Sayfa görünmez WebView'de açılır, dış istek yapmaz, JavaScript kapalıdır. */
object Pdf {
    fun fromHtml(context: Context, html: String, done: (Result<ByteArray>) -> Unit) {
        val web = WebView(context)
        web.settings.javaScriptEnabled = false
        web.settings.blockNetworkLoads = true
        web.webViewClient = object : WebViewClient() {
            var started = false
            override fun onPageFinished(view: WebView, url: String) {
                if (started) return
                started = true
                Handler(Looper.getMainLooper()).postDelayed({
                    val attrs = PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                        .setResolution(PrintAttributes.Resolution("pdf", "pdf", 300, 300))
                        .setMinMargins(PrintAttributes.Margins(550, 630, 550, 630)).build()
                    val file = File.createTempFile("belge", ".pdf", context.cacheDir)
                    PdfPrint.print(view.createPrintDocumentAdapter("belge"), attrs, file) { error ->
                        val r = if (error == null) runCatching { file.readBytes() } else Result.failure(Exception(error))
                        file.delete()
                        view.destroy()
                        done(r)
                    }
                }, 200)
            }
        }
        web.loadDataWithBaseURL(null, html, "text/html", "utf-8", null)
    }
}
