package expo.modules.medialocations

import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import androidx.exifinterface.media.ExifInterface
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.Callable
import java.util.concurrent.Executors

class MediaLocationsModule : Module() {
    private val executor = Executors.newFixedThreadPool(
        Runtime.getRuntime().availableProcessors() * 4
    )

    override fun definition() = ModuleDefinition {
        Name("MediaLocations")

        AsyncFunction("readLocations") { ids: List<String> ->
            val resolver = appContext.reactContext!!.contentResolver
            val uris = ids.map(Uri::parse)
            val paths = HashMap<String, String>(ids.size)

            resolver.query(
                MediaStore.Files.getContentUri("external"),
                arrayOf(
                    MediaStore.Files.FileColumns._ID,
                    MediaStore.Files.FileColumns.DATA
                ),
                "${MediaStore.Files.FileColumns.MEDIA_TYPE} = " +
                    "${MediaStore.Files.FileColumns.MEDIA_TYPE_IMAGE} AND " +
                    "${MediaStore.Files.FileColumns._ID} IN " +
                    uris.joinToString(",", "(", ")") { it.lastPathSegment!! },
                null,
                null
            )?.use { cursor ->
                while (cursor.moveToNext()) {
                    paths[cursor.getString(0)] = cursor.getString(1)
                }
            }

            val coordinates = DoubleArray(ids.size * 2) { Double.NaN }

            executor.invokeAll(
                uris.mapIndexed { index, uri ->
                    Callable {
                        val path = paths[uri.lastPathSegment] ?: return@Callable

                        runCatching {
                            val exif = if (Build.VERSION.SDK_INT == 29) {
                                resolver.openInputStream(
                                    MediaStore.setRequireOriginal(uri)
                                )!!.use { ExifInterface(it) }
                            } else {
                                ExifInterface(path)
                            }

                            exif.latLong?.let { (latitude, longitude) ->
                                coordinates[index * 2] = latitude
                                coordinates[index * 2 + 1] = longitude
                            }
                        }
                    }
                }
            )

            coordinates
        }
    }
}
