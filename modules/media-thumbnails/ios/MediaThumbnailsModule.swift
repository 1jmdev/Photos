import ExpoModulesCore
import Photos
import SDWebImage

public final class MediaThumbnailsModule: Module {
    private let loader = MediaThumbnailLoader()

    public func definition() -> ModuleDefinition {
        Name("MediaThumbnails")

        OnCreate {
            SDImageLoadersManager.shared.addLoader(self.loader)
        }

        OnDestroy {
            SDImageLoadersManager.shared.removeLoader(self.loader)
        }
    }
}

private final class MediaThumbnailLoader: NSObject, SDImageLoader {
    private let manager = PHCachingImageManager()

    func canRequestImage(for url: URL?) -> Bool {
        return url?.scheme == "gallery-thumbnail"
    }

    func requestImage(
        with url: URL?,
        options: SDWebImageOptions = [],
        context: [SDWebImageContextOption: Any]?,
        progress progressBlock: SDImageLoaderProgressBlock?,
        completed completedBlock: SDImageLoaderCompletedBlock? = nil
    ) -> SDWebImageOperation? {
        let operation = MediaThumbnailOperation(manager: manager)

        DispatchQueue.global(qos: options.contains(.lowPriority) ? .utility : .userInitiated).async {
            if operation.isCancelled {
                return
            }
            let components = URLComponents(url: url!, resolvingAgainstBaseURL: false)!
            let identifier = String(components.path.dropFirst())
            guard let asset = PHAsset.fetchAssets(withLocalIdentifiers: [identifier], options: nil).firstObject else {
                completedBlock?(nil, nil, NSError(domain: "MediaThumbnails", code: 1), true)
                return
            }
            let resolution = Double(components.queryItems!.first!.value!)!
            let requestOptions = PHImageRequestOptions()
            requestOptions.deliveryMode = .fastFormat
            requestOptions.resizeMode = .fast
            requestOptions.isNetworkAccessAllowed = !options.contains(.lowPriority)
            operation.requestID = self.manager.requestImage(
                for: asset,
                targetSize: CGSize(width: resolution, height: resolution),
                contentMode: .aspectFill,
                options: requestOptions
            ) { image, information in
                if !operation.isCancelled {
                    completedBlock?(image, nil, information?[PHImageErrorKey] as? Error, true)
                }
            }
            if operation.isCancelled {
                self.manager.cancelImageRequest(operation.requestID)
            }
        }

        return operation
    }

    func shouldBlockFailedURL(with url: URL, error: Error) -> Bool {
        return false
    }
}

private final class MediaThumbnailOperation: Operation, SDWebImageOperation, @unchecked Sendable {
    private let manager: PHCachingImageManager
    private let lock = NSLock()
    private var identifier = PHInvalidImageRequestID

    var requestID: PHImageRequestID {
        get { lock.withLock { identifier } }
        set { lock.withLock { identifier = newValue } }
    }

    init(manager: PHCachingImageManager) {
        self.manager = manager
        super.init()
    }

    override func cancel() {
        super.cancel()
        manager.cancelImageRequest(requestID)
    }
}
