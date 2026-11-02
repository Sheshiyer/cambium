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

    init(anchorProvider: @escaping @MainActor () -> ASPresentationAnchor?) {
        self.anchorProvider = anchorProvider
    }

    func present(_ request: NativeAuthorizationRequest) async -> NativeBrowserResult {
        guard activeSession == nil else { return .failed }
        guard request.redirectURI.scheme == Self.callbackScheme else { return .failed }
        guard anchorProvider() != nil else { return .failed }

        return await withCheckedContinuation { (continuation: CheckedContinuation<NativeBrowserResult, Never>) in
            var finished = false
            let session = ASWebAuthenticationSession(
                url: request.url,
                callbackURLScheme: Self.callbackScheme
            ) { [weak self] callbackURL, error in
                MainActor.assumeIsolated {
                    guard !finished else { return }
                    finished = true
                    self?.activeSession = nil
                    continuation.resume(returning: Self.map(callbackURL: callbackURL, error: error))
                }
            }
            session.prefersEphemeralWebBrowserSession = true
            session.presentationContextProvider = self
            activeSession = session
            if !session.start() {
                finished = true
                activeSession = nil
                continuation.resume(returning: .failed)
            }
        }
    }

    /// Cancel from the user is not a failure. Any other error maps to `.failed`
    /// without its detail, which could carry URL text.
    static func map(callbackURL: URL?, error: Error?) -> NativeBrowserResult {
        if let error {
            let code = (error as NSError).code
            if (error as NSError).domain == ASWebAuthenticationSessionErrorDomain,
               code == ASWebAuthenticationSessionError.canceledLogin.rawValue {
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
