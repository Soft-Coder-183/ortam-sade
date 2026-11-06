package android.print;

import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import java.io.File;
import java.util.function.Consumer;

/** Android'in yazdırma geri çağrılarının kurucuları paket içine açık olduğu için bu sınıf android.print paketindedir. */
public final class PdfPrint {
    private PdfPrint() {}

    /** Bitince hata iletisi (başarılıysa null) ile çağrılır. */
    public static void print(PrintDocumentAdapter adapter, PrintAttributes attrs, File out, Consumer<String> done) {
        adapter.onLayout(null, attrs, null, new PrintDocumentAdapter.LayoutResultCallback() {
            @Override public void onLayoutFinished(PrintDocumentInfo info, boolean changed) {
                try {
                    ParcelFileDescriptor fd = ParcelFileDescriptor.open(out, ParcelFileDescriptor.MODE_CREATE | ParcelFileDescriptor.MODE_TRUNCATE | ParcelFileDescriptor.MODE_READ_WRITE);
                    adapter.onWrite(new PageRange[] { PageRange.ALL_PAGES }, fd, new CancellationSignal(), new PrintDocumentAdapter.WriteResultCallback() {
                        private void close() { try { fd.close(); } catch (Exception ignored) {} }
                        @Override public void onWriteFinished(PageRange[] pages) { close(); done.accept(null); }
                        @Override public void onWriteFailed(CharSequence error) { close(); done.accept("PDF yazılamadı: " + error); }
                        @Override public void onWriteCancelled() { close(); done.accept("PDF iptal edildi"); }
                    });
                } catch (Exception e) { done.accept(e.getMessage()); }
            }
            @Override public void onLayoutFailed(CharSequence error) { done.accept("PDF hazırlanamadı: " + error); }
            @Override public void onLayoutCancelled() { done.accept("PDF iptal edildi"); }
        }, null);
    }
}
