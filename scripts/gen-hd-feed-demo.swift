import Foundation
import AVFoundation
import AppKit

let width = 1080
let height = 1344 // 4:5-ish, multiple of 16 for H.264
let fps: Int32 = 30
let durationSec = 5.0
let outURL = URL(fileURLWithPath: CommandLine.arguments[1])
let posterURL = URL(fileURLWithPath: CommandLine.arguments[2])

try? FileManager.default.removeItem(at: outURL)

let writer = try AVAssetWriter(outputURL: outURL, fileType: .mp4)
let settings: [String: Any] = [
    AVVideoCodecKey: AVVideoCodecType.h264,
    AVVideoWidthKey: width,
    AVVideoHeightKey: height,
    AVVideoCompressionPropertiesKey: [
        AVVideoAverageBitRateKey: 5_000_000,
        AVVideoMaxKeyFrameIntervalKey: 30,
        AVVideoProfileLevelKey: AVVideoProfileLevelH264BaselineAutoLevel,
    ] as [String: Any],
]
let input = AVAssetWriterInput(mediaType: .video, outputSettings: settings)
input.expectsMediaDataInRealTime = false
let attrs: [String: Any] = [
    kCVPixelBufferPixelFormatTypeKey as String: Int(kCVPixelFormatType_32BGRA),
    kCVPixelBufferWidthKey as String: width,
    kCVPixelBufferHeightKey as String: height,
    kCVPixelBufferCGImageCompatibilityKey as String: true,
    kCVPixelBufferCGBitmapContextCompatibilityKey as String: true,
]
let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: attrs)
precondition(writer.canAdd(input))
writer.add(input)
precondition(writer.startWriting(), String(describing: writer.error))
writer.startSession(atSourceTime: .zero)

func makeImage(index: Int) -> CGImage {
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let bytesPerRow = width * 4
    let data = UnsafeMutablePointer<UInt8>.allocate(capacity: bytesPerRow * height)
    defer { data.deallocate() }
    guard let ctx = CGContext(
        data: data,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else { fatalError("ctx") }

    let t = CGFloat(index) / CGFloat(max(1, fps)) / CGFloat(durationSec)
    ctx.setFillColor(CGColor(red: 0.08, green: 0.14, blue: 0.32 + 0.15 * t, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
    ctx.setFillColor(CGColor(red: 0.95, green: 0.95, blue: 0.97, alpha: 1))
    ctx.fill(CGRect(x: 80, y: 280, width: width - 160, height: height - 560))

    // Sharp moving bar
    let barX = 120 + (index * 7) % (width - 360)
    ctx.setFillColor(CGColor(red: 0.1, green: 0.45, blue: 0.95, alpha: 1))
    ctx.fill(CGRect(x: barX, y: 180, width: 200, height: 36))

    // Draw text via NSImage overlay
    let nsimg = NSImage(size: NSSize(width: width, height: height))
    nsimg.lockFocus()
    if let cg = ctx.makeImage() {
        // NSImage is flipped vs CG; draw upright
        let nsCtx = NSGraphicsContext.current!.cgContext
        nsCtx.draw(cg, in: CGRect(x: 0, y: 0, width: width, height: height))
    }
    let paragraph = NSMutableParagraphStyle()
    paragraph.alignment = .center
    let title: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: 64, weight: .bold),
        .foregroundColor: NSColor.black,
        .paragraphStyle: paragraph,
    ]
    let sub: [NSAttributedString.Key: Any] = [
        .font: NSFont.systemFont(ofSize: 32, weight: .semibold),
        .foregroundColor: NSColor(calibratedWhite: 0.25, alpha: 1),
        .paragraphStyle: paragraph,
    ]
    ("HD feed demo" as NSString).draw(
        in: NSRect(x: 100, y: CGFloat(height) / 2 + 20, width: CGFloat(width - 200), height: 80),
        withAttributes: title
    )
    ("1080×1344 · ~4:5 · H.264" as NSString).draw(
        in: NSRect(x: 100, y: CGFloat(height) / 2 - 50, width: CGFloat(width - 200), height: 48),
        withAttributes: sub
    )
    nsimg.unlockFocus()
    var rect = NSRect(x: 0, y: 0, width: width, height: height)
    return nsimg.cgImage(forProposedRect: &rect, context: nil, hints: nil)!
}

func pixelBuffer(from cgImage: CGImage) -> CVPixelBuffer {
    var buffer: CVPixelBuffer?
    let status = CVPixelBufferCreate(
        kCFAllocatorDefault, width, height, kCVPixelFormatType_32BGRA,
        attrs as CFDictionary, &buffer
    )
    precondition(status == kCVReturnSuccess, "CVPixelBufferCreate \(status)")
    let pb = buffer!
    CVPixelBufferLockBaseAddress(pb, [])
    let dest = CVPixelBufferGetBaseAddress(pb)!
    let bytesPerRow = CVPixelBufferGetBytesPerRow(pb)
    let colorSpace = CGColorSpaceCreateDeviceRGB()
    let ctx = CGContext(
        data: dest,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedFirst.rawValue | CGBitmapInfo.byteOrder32Little.rawValue
    )!
    ctx.interpolationQuality = .none
    // Flip so text orientation matches feed
    ctx.translateBy(x: 0, y: CGFloat(height))
    ctx.scaleBy(x: 1, y: -1)
    ctx.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
    CVPixelBufferUnlockBaseAddress(pb, [])
    return pb
}

let frameCount = Int(durationSec * Double(fps))
var i = 0
while i < frameCount {
    if input.isReadyForMoreMediaData {
        let cg = makeImage(index: i)
        if i == 10 {
            let bitmap = NSBitmapImageRep(cgImage: cg)
            if let jpeg = bitmap.representation(using: .jpeg, properties: [.compressionFactor: 0.92]) {
                try! jpeg.write(to: posterURL)
            }
        }
        let pb = pixelBuffer(from: cg)
        let time = CMTime(value: CMTimeValue(i), timescale: fps)
        precondition(adaptor.append(pb, withPresentationTime: time), String(describing: writer.error))
        i += 1
    } else {
        usleep(2000)
    }
}
input.markAsFinished()
let sem = DispatchSemaphore(value: 0)
writer.finishWriting { sem.signal() }
sem.wait()
precondition(writer.status == .completed, String(describing: writer.error))
print("OK \(outURL.path) bytes=\((try? Data(contentsOf: outURL))?.count ?? -1)")
print("poster \(posterURL.path)")
