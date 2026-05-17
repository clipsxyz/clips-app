# Vendored FFmpeg Kit iOS binaries (de-id/ffmpeg-kit release).
# Run: npm run setup:ffmpeg-native  then  cd ios && pod install
Pod::Spec.new do |s|
  s.name             = 'ffmpeg-kit-ios-https-gpl'
  s.version          = '6.0.2'
  s.summary          = 'Vendored ffmpeg-kit iOS xcframeworks (local)'
  s.homepage         = 'https://github.com/de-id/ffmpeg-kit'
  s.license          = { :type => 'LGPL-3.0' }
  s.author           = 'de-id/ffmpeg-kit'
  s.platform         = :ios, '12.1'
  s.source           = { :path => '.' }
  s.static_framework = true

  vendor = 'FFmpegKitVendor'
  s.vendored_frameworks = [
    "#{vendor}/ffmpegkit.xcframework",
    "#{vendor}/libavcodec.xcframework",
    "#{vendor}/libavdevice.xcframework",
    "#{vendor}/libavfilter.xcframework",
    "#{vendor}/libavformat.xcframework",
    "#{vendor}/libavutil.xcframework",
    "#{vendor}/libswresample.xcframework",
    "#{vendor}/libswscale.xcframework",
  ]
end
