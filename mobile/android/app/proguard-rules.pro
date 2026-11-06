# Köprü sınıfının @JavascriptInterface yöntemleri WebView'den adlarıyla çağrılır
-keepclassmembers class io.github.softcoder183.etucep.Native { @android.webkit.JavascriptInterface <methods>; }
-keep class android.print.** { *; }
