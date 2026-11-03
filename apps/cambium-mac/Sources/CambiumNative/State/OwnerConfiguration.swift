import Foundation
import CambiumCore

/// Explicit, non-secret owner configuration for standard mode.
///
/// The default is nil: nothing is contacted and no session exists. A configuration
/// is an HTTPS owner origin, a tenant candidate and reviewed client metadata. It
/// holds no token, secret or session, and it is never read from the environment.
struct OwnerConfiguration: Equatable, Sendable {
    let ownerURL: URL
    let tenantCandidate: String
    let clientId: String
    let redirectURI: URL

    /// Reviewed dev callback registered in Info.plist.in. Not a credential.
    static let reviewedRedirect = "space.thoughtseed.cambium.native.dev://oauth/callback"
    /// Owner origin must be entered explicitly; no live host is bundled.
    /// The remaining values only prefill the Connections form and are not
    /// applied or contacted until the founder explicitly chooses the session action.
    static let mappedOwnerURL = ""
    static let mappedTenant = "cambium"
    static let mappedClientId = "space.thoughtseed.cambium.native.dev"

    enum Problem: String, Equatable, Error {
        case ownerURL = "Owner URL must be an HTTPS origin with no user, password, query or fragment."
        case tenant = "Tenant must be lowercase letters, digits and single hyphens."
        case clientId = "Client ID must be 8 to 128 letters, digits, dots, hyphens or underscores."
        case redirect = "Callback must be the reviewed app callback."
    }

    /// Checks the same contract `NativeIdentityConfiguration` enforces. Nothing is contacted.
    static func validate(ownerURL: String, tenant: String, clientId: String, redirect: String) -> Result<OwnerConfiguration, Problem> {
        let url = ownerURL.trimmingCharacters(in: .whitespacesAndNewlines)
        let tenant = tenant.trimmingCharacters(in: .whitespacesAndNewlines)
        let client = clientId.trimmingCharacters(in: .whitespacesAndNewlines)
        let callback = redirect.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let owner = URL(string: url), let components = URLComponents(url: owner, resolvingAgainstBaseURL: false),
              components.scheme?.lowercased() == "https", components.query == nil, components.fragment == nil,
              (try? HTTPOriginPolicy(url: owner)) != nil else { return .failure(.ownerURL) }
        guard MissionFabricTenant.isValid(tenant) else { return .failure(.tenant) }
        guard NativeIdentityConfiguration.isReviewedClientId(client) else { return .failure(.clientId) }
        guard callback == reviewedRedirect, let redirectURI = URL(string: callback),
              NativeIdentityConfiguration.isExactCallback(redirectURI) else { return .failure(.redirect) }
        guard (try? NativeIdentityConfiguration(owner: owner, clientId: client, redirectURI: redirectURI,
                                                tenantCandidate: tenant)) != nil else { return .failure(.ownerURL) }
        return .success(OwnerConfiguration(ownerURL: owner, tenantCandidate: tenant, clientId: client, redirectURI: redirectURI))
    }

    var identityConfiguration: NativeIdentityConfiguration? {
        try? NativeIdentityConfiguration(owner: ownerURL, clientId: clientId, redirectURI: redirectURI, tenantCandidate: tenantCandidate)
    }

    var origin: HTTPOriginPolicy? { try? HTTPOriginPolicy(url: ownerURL) }
}

/// Already-admitted work is listed by `HTTPAdmissionDiscovery`. This type only
/// names that client. It never constructs an admission reference.
enum AdmissionListing {
    static func discovery(baseURL: URL, transport: any HTTPTransport, authorizer: any RequestAuthorizer) -> any AdmissionDiscovering {
        HTTPAdmissionDiscovery(baseURL: baseURL, transport: transport, authorizer: authorizer)
    }
}
