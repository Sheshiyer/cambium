// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "CambiumNative",
    platforms: [.macOS(.v26)],
    products: [
        .library(name: "CambiumCore", targets: ["CambiumCore"]),
        .executable(name: "CambiumNative", targets: ["CambiumNative"])
    ],
    targets: [
        .target(name: "CambiumCore"),
        .executableTarget(
            name: "CambiumNative",
            dependencies: ["CambiumCore"],
            path: "Sources/CambiumNative",
            resources: [.process("Resources")],
            swiftSettings: [.defaultIsolation(MainActor.self)]
        ),
        .testTarget(name: "CambiumCoreTests", dependencies: ["CambiumCore"])
    ]
)
