package expo.modules.mediathumbnails

import android.content.ContentUris
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.CancellationSignal
import android.provider.MediaStore
import android.util.Size
import com.bumptech.glide.Glide
import com.bumptech.glide.Priority
import com.bumptech.glide.load.DataSource
import com.bumptech.glide.load.Options
import com.bumptech.glide.load.data.DataFetcher
import com.bumptech.glide.load.model.ModelLoader
import com.bumptech.glide.load.model.ModelLoaderFactory
import com.bumptech.glide.load.model.MultiModelLoaderFactory
import com.bumptech.glide.signature.ObjectKey
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MediaThumbnailsModule : Module(), ModelLoader<String, Bitmap>, ModelLoaderFactory<String, Bitmap> {
    override fun definition() = ModuleDefinition {
        Name("MediaThumbnails")

        OnCreate {
            Glide.get(appContext.reactContext!!).registry.prepend(
                String::class.java,
                Bitmap::class.java,
                this@MediaThumbnailsModule
            )
        }
    }

    override fun build(multiFactory: MultiModelLoaderFactory): ModelLoader<String, Bitmap> = this

    override fun teardown() = Unit

    override fun handles(model: String): Boolean = model.startsWith("content://gallery-thumbnail/")

    override fun buildLoadData(
        model: String,
        width: Int,
        height: Int,
        options: Options
    ): ModelLoader.LoadData<Bitmap> = ModelLoader.LoadData(
        ObjectKey(model),
        object : DataFetcher<Bitmap> {
            private val cancellation = CancellationSignal()

            override fun loadData(priority: Priority, callback: DataFetcher.DataCallback<in Bitmap>) {
                runCatching {
                    val resolver = appContext.reactContext!!.contentResolver
                    val uri = Uri.parse(Uri.parse(model).lastPathSegment!!)

                    if (Build.VERSION.SDK_INT >= 29) {
                        resolver.loadThumbnail(uri, Size(width, height), cancellation)
                    } else if (resolver.getType(uri)!!.startsWith("video/")) {
                        MediaStore.Video.Thumbnails.getThumbnail(
                            resolver,
                            ContentUris.parseId(uri),
                            MediaStore.Video.Thumbnails.MINI_KIND,
                            null
                        )
                    } else {
                        MediaStore.Images.Thumbnails.getThumbnail(
                            resolver,
                            ContentUris.parseId(uri),
                            MediaStore.Images.Thumbnails.MINI_KIND,
                            null
                        )
                    }
                }.fold(callback::onDataReady) { callback.onLoadFailed(Exception(it)) }
            }

            override fun cancel() = cancellation.cancel()

            override fun cleanup() = Unit

            override fun getDataClass(): Class<Bitmap> = Bitmap::class.java

            override fun getDataSource(): DataSource = DataSource.LOCAL
        }
    )
}
