import AuthenticationServices
import CambiumCore
import Foundation

// External-browser adapter for founder sign-in. It runs on the main actor and
// uses an ephemeral ASWebAuthenticationSession, so no browser cookies are
// copied in or out. The owning view or window supplies the presentation anchor.
// Nothing here starts a session by itself; tests use a stub browser instead.

@MainActor
final class NativeBrowserSignIn: NSObject, NativeBrowserPresenting, ASWebAuthenticationPresentationContextProviding {
    /// The callback scheme is the reversed-domain dev registration in Info.plist.in.
    static let callbackScheme = "space.thoughtseed.cambium.native.dev"

    private let anchorProvider: @MainActor () -> ASPresentationAnchor?
    private var activeSession: ASWebAuthenticationSession?
    private var pending: CheckedContinuation<NativeBrowserResult, Never>?
    /// Identifies the presentation a completion belongs to, so a late handler
    /// from an earlier session cannot resume a newer one.
    private var presentation: UInt64 = 0

    init(anchorProvider: @escaping @MainActor () -> ASPresentationAnchor?) {
        self.anchorProvider = anchorProvider
    }

    func present(_ request: NativeAuthorizationRequest) async -> NativeBrowserResult {
        guard activeSession == nil, pending == nil else { return .failed }
        guard request.redirectURI.absoluteString == NativeIdentityConfiguration.reviewedRedirectURI.absoluteString,
              request.redirectURI.scheme == Self.callbackScheme else { return .failed }
        guard anchorProvider() != nil else { return .failed }

        presentation &+= 1
        let id = presentation
        return await withCheckedContinuation { (continuation: CheckedContinuation<NativeBrowserResult, Never>) in
            pending = continuation
            // AuthenticationServices does not promise the queue for this handler.
            // It is nonisolated and hops to the main actor before touching state.
            let completion: @Sendable (URL?, (any Error)?) -> Void = { [weak self] callbackURL, error in
                let result = NativeBrowserSignIn.map(callbackURL: callbackURL, error: error)
                Task { @MainActor in self?.finish(id, result) }
            }
            let session = ASWebAuthenticationSession(
                url: request.url,
                callbackURLScheme: Self.callbackScheme,
                completionHandler: completion
            )
            session.prefersEphemeralWebBrowserSession = true
            session.presentationContextProvider = self
            activeSession = session
            if !session.start() {
                finish(id, .failed)
            }
        }
    }

    /// Ends the current browser presentation as canceled. Starts nothing.
    func cancel() {
        activeSession?.cancel()
        finish(presentation, .canceled)
    }

    private func finish(_ id: UInt64, _ result: NativeBrowserResult) {
        guard id == presentation, let continuation = pending else { return }
        pending = nil
        activeSession = nil
        continuation.resume(returning: result)
    }

    /// Cancel from the user is not a failure. Any other error maps to `.failed`
    /// without its detail, which could carry URL text.
    nonisolated static func map(callbackURL: URL?, error: (any Error)?) -> NativeBrowserResult {
        if let error {
            let nsError = error as NSError
            if nsError.domain == ASWebAuthenticationSessionErrorDomain,
               nsError.code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
                return .canceled
            }
            return .failed
        }
        guard let callbackURL else { return .failed }
        return .callback(callbackURL)
    }

    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        anchorProvider() ?? ASPresentationAnchor()
    }
}
