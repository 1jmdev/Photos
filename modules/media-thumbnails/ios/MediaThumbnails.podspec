Pod::Spec.new do |s|
    s.name = 'MediaThumbnails'
    s.version = '1.0.0'
    s.summary = 'System media thumbnails for the photo grid'
    s.description = s.summary
    s.license = { :type => 'MIT' }
    s.author = 'Photos'
    s.homepage = 'https://github.com/expo/expo'
    s.platforms = { :ios => '16.4' }
    s.swift_version = '5.9'
    s.source = { :git => 'https://github.com/expo/expo.git' }
    s.static_framework = true
    s.dependency 'ExpoModulesCore'
    s.dependency 'SDWebImage', '~> 5.21.0'
    s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
    s.source_files = '**/*.swift'
end
